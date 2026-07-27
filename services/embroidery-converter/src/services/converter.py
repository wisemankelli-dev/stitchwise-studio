"""
Grid-to-Embroidery Converter — converts StitchCell[][] grid data
into machine embroidery files (.dst, .pes) using pyembroidery.

Each cell in the grid = one stitch. Colors are grouped and processed
sequentially with color changes between each color group.

Stitch scale: 1 grid cell = 2.0mm = 20 embroidery units (1/10th mm).
"""

import io
import logging
import math
import tempfile
from pathlib import Path
from typing import Optional

import pyembroidery

logger = logging.getLogger(__name__)

# Scale factor: how many embroidery units (1/10th mm) per grid cell
# 20 = 2.0mm per stitch, which is standard for cross-stitch on 14-count fabric
STITCH_SCALE = 20

# Supported output formats
SUPPORTED_FORMATS = {
    "dst": {"extension": ".dst", "description": "Tajima (industry standard)"},
    "pes": {"extension": ".pes", "description": "Brother / Bernina (home machines)"},
}


def hex_to_rgb_int(hex_color: str) -> int:
    """Convert a hex color string (e.g. '#ff0000') to a 24-bit RGB integer."""
    hex_color = hex_color.lstrip("#")
    return (int(hex_color[0:2], 16) << 16) | (int(hex_color[2:4], 16) << 8) | int(hex_color[4:6], 16)


def hex_to_rgb(hex_color: str) -> tuple[int, int, int]:
    """Convert a hex color string (e.g. '#ff0000' or 'ff0000') to an RGB tuple."""
    hex_color = hex_color.lstrip("#")
    return (
        int(hex_color[0:2], 16),
        int(hex_color[2:4], 16),
        int(hex_color[4:6], 16),
    )


def grid_to_pattern(
    grid: list[list[dict]],
    dmc_palette: list[dict],
) -> pyembroidery.EmbPattern:
    """Convert a StitchCell[][] grid into a pyembroidery EmbPattern.

    Each cell is a dict with at minimum a 'color' hex string.
    Cells with color '#ffffff' or empty string are treated as empty (no stitch).

    Colors are grouped: all cells of one DMC color are stitched together,
    then a color change is issued before the next color group. Within each
    color group, cells are processed in row-major order with jump stitches
    between non-adjacent cells.

    Args:
        grid: 2D list of stitch cells (grid[row][col]), each with a 'color' hex.
        dmc_palette: List of DmcUsage entries with hex, code, name.

    Returns:
        A pyembroidery.EmbPattern ready for export to .dst or .pes.
    """
    if not grid or not grid[0]:
        raise ValueError("Grid must be non-empty")

    height = len(grid)
    width = len(grid[0])

    # Build a color → list of (row, col) mapping for non-empty cells
    color_groups: dict[str, list[tuple[int, int]]] = {}

    for row in range(height):
        row_data = grid[row]
        for col in range(min(width, len(row_data))):
            cell = row_data[col]
            color = cell.get("color", "").strip()
            if not color or color.lower() in ("#ffffff", "#fff", "white", ""):
                continue
            # Normalize hex to lowercase
            color = color.lower()
            if color not in color_groups:
                color_groups[color] = []
            color_groups[color].append((row, col))

    pattern = pyembroidery.EmbPattern()

    # Process colors in the order they appear in the DMC palette
    palette_order = {entry.get("hex", "").lower(): i for i, entry in enumerate(dmc_palette)}

    def sort_key(hex_color: str) -> int:
        return palette_order.get(hex_color, len(palette_order))

    sorted_colors = sorted(color_groups.keys(), key=sort_key)

    for hex_color in sorted_colors:
        cells = color_groups[hex_color]
        if not cells:
            continue

        # EmbThread takes a single 24-bit RGB integer
        rgb_int = hex_to_rgb_int(hex_color)
        pattern.add_thread(pyembroidery.EmbThread(rgb_int))

        # Color change
        pattern.stitch_abs(pyembroidery.COLOR_CHANGE, 0, 0)

        # Sort cells in row-major order for efficient stitching
        cells.sort()

        prev_x, prev_y = None, None

        for row, col in cells:
            # Convert grid position to embroidery coordinates
            x = col * STITCH_SCALE
            y = row * STITCH_SCALE

            if prev_x is None:
                # First stitch of this color: jump to position then stitch
                pattern.stitch_abs(pyembroidery.JUMP, x, y)
                pattern.stitch_abs(pyembroidery.STITCH, x, y)
            else:
                # Check if this cell is adjacent to previous (within 1 cell)
                dx = abs(x - prev_x)
                dy = abs(y - prev_y)

                if dx <= STITCH_SCALE * 2 and dy <= STITCH_SCALE * 2:
                    # Adjacent or nearby: normal stitch
                    pattern.stitch_abs(pyembroidery.STITCH, x, y)
                else:
                    # Non-adjacent: jump to new position
                    pattern.stitch_abs(pyembroidery.JUMP, x, y)
                    pattern.stitch_abs(pyembroidery.STITCH, x, y)

            prev_x, prev_y = x, y

    # End of design
    pattern.stitch_abs(pyembroidery.END, 0, 0)

    return pattern


def export_bytes(pattern: pyembroidery.EmbPattern, output_format: str) -> bytes:
    """Export a pyembroidery EmbPattern to bytes in the given format.

    Args:
        pattern: The embroidery pattern to export.
        output_format: Target format ('dst' or 'pes').

    Returns:
        Binary content of the embroidery file.

    Raises:
        ValueError: If the format is unsupported.
        RuntimeError: If pyembroidery fails to write.
    """
    output_format = output_format.lower()
    if output_format not in SUPPORTED_FORMATS:
        raise ValueError(
            f"Unsupported format '{output_format}'. "
            f"Supported: {', '.join(SUPPORTED_FORMATS)}"
        )

    suffix = SUPPORTED_FORMATS[output_format]["extension"]

    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp_path = tmp.name

    try:
        pyembroidery.write(pattern, tmp_path)
        with open(tmp_path, "rb") as f:
            return f.read()
    except Exception as e:
        logger.error(f"Failed to export to {output_format}: {e}")
        raise RuntimeError(f"Export to {output_format} failed: {e}") from e
    finally:
        Path(tmp_path).unlink(missing_ok=True)


def get_format_info() -> dict:
    """Return information about supported embroidery formats."""
    return {
        "formats": SUPPORTED_FORMATS,
        "default": "dst",
    }
