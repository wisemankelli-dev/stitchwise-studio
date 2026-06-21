"""
Stitch generation service — core logic for converting design data
to machine embroidery stitch files (.dst, .pes, .exp).

Uses pyembroidery for low-level stitch data manipulation and file I/O.
"""

import io
import logging
from pathlib import Path
from typing import Optional
import pyembroidery

logger = logging.getLogger(__name__)

# Standard thread color palette (subset of common DMC-like colors)
STANDARD_THREADS = {
    "black": (0, 0, 0),
    "white": (255, 255, 255),
    "red": (255, 0, 0),
    "blue": (0, 0, 255),
    "green": (0, 128, 0),
    "yellow": (255, 255, 0),
    "purple": (128, 0, 128),
    "orange": (255, 165, 0),
    "pink": (255, 192, 203),
    "brown": (165, 42, 42),
    "gray": (128, 128, 128),
    "dark_blue": (0, 0, 139),
    "light_blue": (173, 216, 230),
    "gold": (255, 215, 0),
    "teal": (0, 128, 128),
}

SUPPORTED_FORMATS = {
    "dst": {"extension": ".dst", "description": "Tajima (industry standard)"},
    "pes": {"extension": ".pes", "description": "Brother / Bernina (home machines)"},
    "exp": {"extension": ".exp", "description": "Melco"},
    "jef": {"extension": ".jef", "description": "Janome"},
    "vp3": {"extension": ".vp3", "description": "Pfaff / Husqvarna / Viking"},
    "pxf": {"extension": ".pxf", "description": "Pfaff"},
    "xxx": {"extension": ".xxx", "description": "Singer / Toyota"},
}


class StitchPattern:
    """Represents a stitch pattern with commands, coordinates, and color changes."""

    def __init__(self):
        # Stitch commands: (x, y, stitch_type)
        # stitch_type: 0 = normal, 1 = jump, 2 = trim, 3 = color_change
        self.stitches: list[tuple[int, int, int]] = []
        self.thread_colors: list[tuple[int, int, int]] = []
        self.metadata: dict = {}
        self._current_color: tuple[int, int, int] = (0, 0, 0)

    def add_stitch(self, x: int, y: int, stitch_type: int = 0) -> None:
        """Add a single stitch at (x, y)."""
        self.stitches.append((x, y, stitch_type))

    def add_color_change(self, color: tuple[int, int, int]) -> None:
        """Record a color change to the given RGB color."""
        self._current_color = color
        self.thread_colors.append(color)
        self.stitches.append((0, 0, 3))  # color_change command

    def add_jump(self, x: int, y: int) -> None:
        """Add a jump stitch (needle up, move, needle down)."""
        self.stitches.append((x, y, 1))

    def to_pyembroidery(self) -> pyembroidery.EmbPattern:
        """Convert this StitchPattern to a pyembroidery EmbPattern for export."""
        pattern = pyembroidery.EmbPattern()

        # Set thread colors
        for r, g, b in self.thread_colors:
            pattern.add_thread(pyembroidery.EmbThread(r, g, b))

        # Add all stitches sequentially
        for x, y, cmd in self.stitches:
            if cmd == 0:  # normal stitch
                pattern.add_stitch_absolute(pyembroidery.STITCH, x, y)
            elif cmd == 1:  # jump
                pattern.add_stitch_absolute(pyembroidery.JUMP, x, y)
            elif cmd == 2:  # trim
                pattern.add_stitch_absolute(pyembroidery.TRIM, x, y)
            elif cmd == 3:  # color change
                pattern.add_stitch_absolute(pyembroidery.COLOR_CHANGE, x, y)

        return pattern


def generate_stitches_from_svg_paths(
    paths: list[dict],
    stitch_density: float = 4.0,
) -> StitchPattern:
    """Convert a list of SVG paths into stitch commands.

    Each path dict should have:
    - 'segments': list of (x, y, cmd) where cmd is 'M' (move), 'L' (line), 'C' (curve)
    - 'color': RGB tuple
    - 'type': 'running' | 'fill'

    Args:
        paths: List of parsed SVG path data.
        stitch_density: Stitches per mm (default 4 = 0.25mm spacing).

    Returns:
        StitchPattern with all stitch commands.
    """
    pattern = StitchPattern()
    scale = 10.0  # Convert mm to embroidery units (1/10 mm)

    for path in paths:
        color = path.get("color", (0, 0, 0))
        stitch_type = path.get("type", "running")
        segments = path.get("segments", [])

        pattern.add_color_change(color)

        if stitch_type == "running":
            _generate_running_stitches(pattern, segments, scale, stitch_density)
        elif stitch_type == "fill":
            _generate_fill_stitches(pattern, segments, scale, stitch_density)

    return pattern


def _generate_running_stitches(
    pattern: StitchPattern,
    segments: list,
    scale: float,
    stitch_density: float,
) -> None:
    """Generate running stitches along a set of path segments."""
    prev_x, prev_y = 0, 0

    for i, seg in enumerate(segments):
        x, y, cmd = seg
        sx, sy = int(x * scale), int(y * scale)

        if cmd == "M":  # Move (jump)
            if i > 0:
                pattern.add_jump(sx, sy)
            prev_x, prev_y = sx, sy
        elif cmd == "L":  # Line
            # Interpolate stitches along the line
            dx = sx - prev_x
            dy = sy - prev_y
            distance = (dx * dx + dy * dy) ** 0.5
            step = int(10.0 / stitch_density)  # step in embroidery units

            if distance > 0:
                steps = max(1, int(distance / step))
                for s in range(steps + 1):
                    t = s / steps
                    ix = int(prev_x + dx * t)
                    iy = int(prev_y + dy * t)
                    pattern.add_stitch(ix, iy)

            prev_x, prev_y = sx, sy


def _generate_fill_stitches(
    pattern: StitchPattern,
    segments: list,
    scale: float,
    stitch_density: float,
) -> None:
    """Generate fill stitches within a closed path boundary.

    Uses a simple scan-line fill approach. For production use,
    Ink/Stitch's tatami fill is preferred for better quality.
    """
    # Extract polygon points from segments
    points = []
    for seg in segments:
        x, y, cmd = seg
        if cmd in ("M", "L"):
            points.append((int(x * scale), int(y * scale)))

    if len(points) < 3:
        # Not a polygon, fall back to running stitch
        _generate_running_stitches(pattern, segments, scale, stitch_density)
        return

    # Simple scanline fill
    min_y = min(p[1] for p in points)
    max_y = max(p[1] for p in points)
    step = int(10.0 / stitch_density)

    for y in range(min_y, max_y + 1, step):
        intersections = []
        for i in range(len(points)):
            p1 = points[i]
            p2 = points[(i + 1) % len(points)]

            if (p1[1] <= y < p2[1]) or (p2[1] <= y < p1[1]):
                if p2[1] != p1[1]:
                    x_int = p1[0] + (y - p1[1]) * (p2[0] - p1[0]) / (p2[1] - p1[1])
                    intersections.append(int(x_int))

        intersections.sort()
        for i in range(0, len(intersections) - 1, 2):
            x1 = intersections[i]
            x2 = intersections[i + 1]
            for x in range(x1, x2, step):
                pattern.add_stitch(x, y)


def export_pattern(
    pattern: StitchPattern,
    output_format: str,
    output_path: Optional[str] = None,
) -> bytes:
    """Export a StitchPattern to the specified embroidery format.

    Args:
        pattern: The stitch pattern to export.
        output_format: Target format ('dst', 'pes', 'exp', 'jef', etc.).
        output_path: Optional file path to write to. If None, returns bytes.

    Returns:
        Bytes of the embroidery file if output_path is None.

    Raises:
        ValueError: If the format is not supported.
    """
    pyemb_pattern = pattern.to_pyembroidery()

    if output_format not in SUPPORTED_FORMATS:
        raise ValueError(
            f"Unsupported format '{output_format}'. "
            f"Supported: {', '.join(SUPPORTED_FORMATS)}"
        )

    if output_path:
        pyembroidery.write(pyemb_pattern, output_path, output_format)
        with open(output_path, "rb") as f:
            return f.read()
    else:
        # Write to bytes buffer
        buf = io.BytesIO()
        # pyembroidery's write function can take a file-like object
        # but not all format writers support it; write to temp file instead
        import tempfile

        with tempfile.NamedTemporaryFile(suffix=f".{output_format}", delete=False) as tmp:
            tmp_path = tmp.name

        try:
            pyembroidery.write(pyemb_pattern, tmp_path, output_format)
            with open(tmp_path, "rb") as f:
                return f.read()
        finally:
            Path(tmp_path).unlink(missing_ok=True)


def convert_file(
    input_path: str,
    output_format: str,
    output_path: Optional[str] = None,
) -> bytes:
    """Convert an existing embroidery file to another format.

    Args:
        input_path: Path to the source embroidery file.
        output_format: Target format ('dst', 'pes', etc.).
        output_path: Optional output file path.

    Returns:
        Bytes of the converted file.
    """
    pattern = pyembroidery.read(input_path)

    if output_path:
        pyembroidery.write(pattern, output_path, output_format)
        with open(output_path, "rb") as f:
            return f.read()
    else:
        import tempfile

        with tempfile.NamedTemporaryFile(suffix=f".{output_format}", delete=False) as tmp:
            tmp_path = tmp.name

        try:
            pyembroidery.write(pattern, tmp_path, output_format)
            with open(tmp_path, "rb") as f:
                return f.read()
        finally:
            Path(tmp_path).unlink(missing_ok=True)


def get_format_info() -> dict:
    """Return information about supported embroidery formats."""
    return {
        "formats": SUPPORTED_FORMATS,
        "default": "dst",
    }