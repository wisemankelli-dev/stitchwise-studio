"""
FastAPI routes for the StitchWise Embroidery Converter Service.
"""

import logging
from typing import Optional

from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel, Field

from src.services.converter import (
    SUPPORTED_FORMATS,
    export_bytes,
    get_format_info,
    grid_to_pattern,
)

logger = logging.getLogger(__name__)
router = APIRouter()

# ─── Pydantic models ────────────────────────────────────────────────────────


class StitchCell(BaseModel):
    """A single cell in the stitch grid."""
    color: str = Field(..., description="Hex color string, e.g. '#ff0000'")
    dmcCode: Optional[str] = Field(None, description="DMC thread code, e.g. 'DMC 321'")
    dmcName: Optional[str] = Field(None, description="DMC color name, e.g. 'Christmas Red'")


class DmcPaletteEntry(BaseModel):
    """A DMC palette entry with color information."""
    code: str = Field(..., description="DMC product code, e.g. 'DMC 321'")
    name: str = Field(..., description="Human-readable color name")
    hex: str = Field(..., description="Hex color, e.g. '#e11d48'")
    count: int = Field(default=0, description="Number of stitches using this color")
    symbol: Optional[str] = Field(None, description="Cross-stitch symbol")


class ConvertRequest(BaseModel):
    """Request body for the /convert endpoint."""
    grid: list[list[StitchCell]] = Field(
        ..., description="2D grid of stitch cells (grid[row][col])"
    )
    format: str = Field(
        default="dst",
        min_length=3,
        max_length=3,
        description="Target format: 'dst' or 'pes'",
    )
    dmcPalette: list[DmcPaletteEntry] = Field(
        default_factory=list,
        description="DMC color palette for thread ordering",
    )


class HealthResponse(BaseModel):
    """Health check response."""
    status: str
    service: str


class FormatsResponse(BaseModel):
    """List of supported formats."""
    formats: dict
    default: str


# ─── Routes ─────────────────────────────────────────────────────────────────


@router.get("/health", response_model=HealthResponse)
async def health():
    """Health check endpoint."""
    return HealthResponse(status="ok", service="embroidery-converter")


@router.get("/formats", response_model=FormatsResponse)
async def formats():
    """List all supported embroidery formats with descriptions."""
    info = get_format_info()
    return FormatsResponse(
        formats=info["formats"],
        default=info["default"],
    )


@router.post("/convert")
async def convert(req: ConvertRequest):
    """Convert a StitchCell[][] grid into an embroidery file.

    Accepts a 2D grid of stitch cells, each with a hex color, and
    produces a binary embroidery file in the requested format (.dst or .pes).

    Returns the binary file with appropriate Content-Disposition headers.
    """
    output_format = req.format.lower()
    if output_format not in SUPPORTED_FORMATS:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Unsupported format '{output_format}'. "
                f"Supported: {', '.join(SUPPORTED_FORMATS)}"
            ),
        )

    # Validate grid is non-empty and rectangular
    if not req.grid or not req.grid[0]:
        raise HTTPException(status_code=400, detail="Grid must be non-empty")

    width = len(req.grid[0])
    for i, row in enumerate(req.grid):
        if len(row) != width:
            raise HTTPException(
                status_code=400,
                detail=f"Grid row {i} has {len(row)} cells, expected {width}",
            )

    try:
        # Convert Pydantic models to dicts for the converter
        grid_dicts = [
            [cell.model_dump() for cell in row]
            for row in req.grid
        ]
        palette_dicts = [entry.model_dump() for entry in req.dmcPalette]

        pattern = grid_to_pattern(grid_dicts, palette_dicts)
        file_bytes = export_bytes(pattern, output_format)

        suffix = SUPPORTED_FORMATS[output_format]["extension"]
        return Response(
            content=file_bytes,
            media_type="application/octet-stream",
            headers={
                "Content-Disposition": f"attachment; filename=pattern{suffix}",
            },
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        logger.error(f"Conversion failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Conversion failed: {str(e)}")
