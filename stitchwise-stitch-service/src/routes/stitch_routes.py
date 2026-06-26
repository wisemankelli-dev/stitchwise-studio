"""
Flask API routes for the StitchWise Stitch Service.
"""

import logging
import tempfile
from pathlib import Path
from flask import Blueprint, jsonify, request, send_file
from werkzeug.utils import secure_filename

from src.services.stitch_generator import (
    StitchPattern,
    SUPPORTED_FORMATS,
    export_pattern,
    convert_file,
    generate_stitches_from_svg_paths,
    get_format_info,
)
from src.services.thread_estimator import estimate_thread, run_validation

logger = logging.getLogger(__name__)
stitch_bp = Blueprint("stitch", __name__)

# Max upload size: 10MB
MAX_CONTENT_LENGTH = 10 * 1024 * 1024
ALLOWED_UPLOAD_EXTENSIONS = {".dst", ".pes", ".exp", ".jef", ".vp3", ".pxf", ".xxx"}


@stitch_bp.route("/health", methods=["GET"])
def health():
    """Health check endpoint."""
    return jsonify({"status": "ok", "service": "stitch-service"})


@stitch_bp.route("/formats", methods=["GET"])
def formats():
    """List supported embroidery formats."""
    return jsonify(get_format_info())


@stitch_bp.route("/convert", methods=["POST"])
def convert():
    """Convert an uploaded embroidery file to another format.

    Expects:
        - file: The embroidery file to convert
        - format: Target format (e.g., 'pes', 'dst')

    Returns:
        The converted file as a download.
    """
    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400

    file = request.files["file"]
    if file.filename == "":
        return jsonify({"error": "Empty filename"}), 400

    target_format = request.form.get("format", "").lower()
    if target_format not in SUPPORTED_FORMATS:
        return jsonify({
            "error": f"Unsupported format '{target_format}'",
            "supported": list(SUPPORTED_FORMATS.keys()),
        }), 400

    # Save uploaded file to temp location
    suffix = Path(secure_filename(file.filename)).suffix.lower()
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp_path = tmp.name
        file.save(tmp_path)

    try:
        # Convert format
        output_suffix = SUPPORTED_FORMATS[target_format]["extension"]

        with tempfile.NamedTemporaryFile(suffix=output_suffix, delete=False) as out_tmp:
            out_path = out_tmp.name

        convert_file(tmp_path, target_format, out_path)

        return send_file(
            out_path,
            as_attachment=True,
            download_name=f"converted{output_suffix}",
            mimetype="application/octet-stream",
        )
    except Exception as e:
        logger.error(f"Conversion failed: {e}")
        return jsonify({"error": f"Conversion failed: {str(e)}"}), 500
    finally:
        Path(tmp_path).unlink(missing_ok=True)


@stitch_bp.route("/generate", methods=["POST"])
def generate():
    """Generate an embroidery file from SVG path data.

    Expects JSON body:
    ```json
    {
        "paths": [
            {
                "segments": [[x, y, "M"], [x, y, "L"], ...],
                "color": [255, 0, 0],
                "type": "running"
            }
        ],
        "format": "dst",
        "stitch_density": 4.0
    }
    ```
    """
    data = request.get_json(silent=True)
    if not data or "paths" not in data:
        return jsonify({"error": "Request body must contain 'paths' array"}), 400

    output_format = data.get("format", "dst").lower()
    if output_format not in SUPPORTED_FORMATS:
        return jsonify({
            "error": f"Unsupported format '{output_format}'",
            "supported": list(SUPPORTED_FORMATS.keys()),
        }), 400

    try:
        paths = _normalize_paths(data["paths"])
        stitch_density = data.get("stitch_density", 4.0)

        pattern = generate_stitches_from_svg_paths(paths, stitch_density)

        output_suffix = SUPPORTED_FORMATS[output_format]["extension"]
        with tempfile.NamedTemporaryFile(suffix=output_suffix, delete=False) as tmp:
            tmp_path = tmp.name

        export_pattern(pattern, output_format, tmp_path)

        return send_file(
            tmp_path,
            as_attachment=True,
            download_name=f"stitch_design{output_suffix}",
            mimetype="application/octet-stream",
        )
    except Exception as e:
        logger.error(f"Generation failed: {e}")
        return jsonify({"error": f"Generation failed: {str(e)}"}), 500


def _normalize_paths(raw_paths: list) -> list:
    """Normalize path data from JSON to internal format."""
    normalized = []
    for raw in raw_paths:
        segments = []
        for seg in raw.get("segments", []):
            x, y, cmd = seg
            segments.append((float(x), float(y), str(cmd)))

        color = raw.get("color", [0, 0, 0])
        if isinstance(color, list) and len(color) == 3:
            color = tuple(color)

        normalized.append({
            "segments": segments,
            "color": color,
            "type": raw.get("type", "running"),
        })
    return normalized


# ─── Thread Usage Estimation ─────────────────────────────────────────────


@stitch_bp.route("/estimate-thread", methods=["POST"])
def estimate_thread_route():
    """Estimate thread usage for a stitch pattern.

    Accepts the same path data as /generate, plus optional estimation params.
    Does NOT generate a file — only calculates thread consumption.

    Expects JSON body:
    ```json
    {
        "paths": [{"segments": [...], "color": [R,G,B], "type": "running"}],
        "format": "dst",
        "stitch_density": 4.0,
        "fabric_thickness_mm": 0.5,
        "satin_column_width": 0.0,
        "underlay_type": "none"
    }
    ```

    Returns JSON with thread estimates per color and totals.
    """
    data = request.get_json(silent=True)
    if not data or "paths" not in data:
        return jsonify({"error": "Request body must contain 'paths' array"}), 400

    try:
        paths = _normalize_paths(data["paths"])
        stitch_density = data.get("stitch_density", 4.0)

        # Generate the stitch pattern using the existing generator
        pattern = generate_stitches_from_svg_paths(paths, stitch_density)

        # Determine stitch type (default to running if not specified)
        stitch_type = data.get("stitch_type", "running")
        if stitch_type not in ("running", "fill", "satin"):
            return jsonify({
                "error": f"Unsupported stitch type '{stitch_type}'. Must be 'running', 'fill', or 'satin'"
            }), 400

        # Optional parameters
        fabric_thickness = data.get("fabric_thickness_mm", 0.5)
        satin_width = data.get("satin_column_width", 0.0)
        underlay = data.get("underlay_type", "none")

        if underlay not in ("none", "edge_run", "zigzag", "center_run"):
            return jsonify({
                "error": f"Unsupported underlay type '{underlay}'"
            }), 400

        # Calculate estimate
        result = estimate_thread(
            stitches=pattern.stitches,
            thread_colors=pattern.thread_colors,
            stitch_type=stitch_type,
            stitch_density=stitch_density,
            fabric_thickness_mm=fabric_thickness,
            satin_column_width=satin_width,
            underlay_type=underlay,
        )

        return jsonify(result)

    except Exception as e:
        logger.error(f"Thread estimation failed: {e}")
        return jsonify({"error": f"Thread estimation failed: {str(e)}"}), 500


@stitch_bp.route("/estimate-thread/validate", methods=["GET"])
def estimate_thread_validate():
    """Run built-in validation test cases for the thread estimator.

    Returns JSON array of test results. Useful for CI and manual verification.
    """
    try:
        results = run_validation()
        return jsonify({
            "test_count": len(results),
            "results": results,
        })
    except Exception as e:
        logger.error(f"Validation failed: {e}")
        return jsonify({"error": f"Validation failed: {str(e)}"}), 500