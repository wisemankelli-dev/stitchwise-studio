"""
FastAPI routes for the StitchWise Stitch Service.
"""

import logging
import tempfile
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel, Field

from src.services.stitch_generator import (
    SUPPORTED_FORMATS,
    convert_file,
    export_pattern,
    generate_stitches_from_svg_paths,
    get_format_info,
)

logger = logging.getLogger(__name__)
router = APIRouter()

# ---------------------------------------------------------------------------
# Pydantic models for request/response schemas
# ---------------------------------------------------------------------------


class PathSegment(BaseModel):
    """A single segment in a path (from SVG)."""
    x: float
    y: float
    cmd: str = Field(..., pattern="^[MLCZmlcz]$",
                     description="SVG path command: M (move), L (line), C (curve), Z (close)")


class DesignPath(BaseModel):
    """A single design path with segments, color, and stitch type."""
    segments: list[PathSegment]
    color: list[int] = Field(default=[0, 0, 0], min_length=3, max_length=3,
                             description="RGB color as [r, g, b]")
    stitch_type: str = Field(default="running", pattern="^(running|fill)$",
                             description="Type of stitch: 'running' or 'fill'")


class GenerateRequest(BaseModel):
    """Request body for the generate endpoint."""
    paths: list[DesignPath] = Field(..., description="List of design paths to stitch")
    format: str = Field(default="dst", min_length=3, max_length=3,
                        description="Target embroidery format (dst, pes, exp, ...)")
    stitch_density: float = Field(default=4.0, ge=1.0, le=20.0,
                                  description="Stitches per mm (1-20)")


class HealthResponse(BaseModel):
    """Health check response."""
    status: str
    service: str


class FormatInfo(BaseModel):
    """Information about a supported format."""
    extension: str
    description: str


class FormatsResponse(BaseModel):
    """List of supported formats."""
    formats: dict[str, FormatInfo]
    default: str


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@router.get("/health", response_model=HealthResponse)
async def health():
    """Health check endpoint."""
    return HealthResponse(status="ok", service="stitch-service")


@router.get("/formats", response_model=FormatsResponse)
async def formats():
    """List all supported embroidery formats with descriptions."""
    info = get_format_info()
    return FormatsResponse(
        formats={code: FormatInfo(**details) for code, details in info["formats"].items()},
        default=info["default"],
    )


@router.post("/generate")
async def generate(req: GenerateRequest):
    """Generate an embroidery file from SVG path data.

    Converts vector path segments into stitch commands and exports
    to the target embroidery format (.dst, .pes, .exp, etc.).
    """
    output_format = req.format.lower()
    if output_format not in SUPPORTED_FORMATS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported format '{output_format}'. Supported: {', '.join(SUPPORTED_FORMATS)}",
        )

    try:
        # Convert Pydantic models to the internal dict format
        paths_data = []
        for p in req.paths:
            paths_data.append({
                "segments": [(seg.x, seg.y, seg.cmd) for seg in p.segments],
                "color": tuple(p.color),
                "type": p.stitch_type,
            })

        pattern = generate_stitches_from_svg_paths(paths_data, req.stitch_density)

        output_suffix = SUPPORTED_FORMATS[output_format]["extension"]
        with tempfile.NamedTemporaryFile(suffix=output_suffix, delete=False) as tmp:
            tmp_path = tmp.name

        try:
            export_pattern(pattern, output_format, tmp_path)
            with open(tmp_path, "rb") as f:
                file_bytes = f.read()
        finally:
            Path(tmp_path).unlink(missing_ok=True)

        return Response(
            content=file_bytes,
            media_type="application/octet-stream",
            headers={"Content-Disposition": f"attachment; filename=stitch_design{output_suffix}"},
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Generation failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Generation failed: {str(e)}")


@router.post("/convert")
async def convert(
    file: UploadFile = File(..., description="Embroidery file to convert"),
    format: str = Form(..., description="Target format (dst, pes, exp, ...)"),
):
    """Upload an embroidery file and convert it to another format.

    Accepts .dst, .pes, .exp, .jef, .vp3, .pxf, .xxx files and
    converts them to the requested target format.
    """
    target_format = format.lower()
    if target_format not in SUPPORTED_FORMATS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported format '{target_format}'. Supported: {', '.join(SUPPORTED_FORMATS)}",
        )

    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")

    # Save uploaded file to temp
    input_suffix = Path(file.filename).suffix.lower()
    with tempfile.NamedTemporaryFile(suffix=input_suffix, delete=False) as tmp:
        tmp_path = tmp.name
        content = await file.read()
        tmp.write(content)

    try:
        output_suffix = SUPPORTED_FORMATS[target_format]["extension"]
        with tempfile.NamedTemporaryFile(suffix=output_suffix, delete=False) as out_tmp:
            out_path = out_tmp.name

        convert_file(tmp_path, target_format, out_path)

        with open(out_path, "rb") as f:
            file_bytes = f.read()

        return Response(
            content=file_bytes,
            media_type="application/octet-stream",
            headers={"Content-Disposition": f"attachment; filename=converted{output_suffix}"},
        )
    except Exception as e:
        logger.error(f"Conversion failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Conversion failed: {str(e)}")
    finally:
        Path(tmp_path).unlink(missing_ok=True)
        Path(out_path).unlink(missing_ok=True)