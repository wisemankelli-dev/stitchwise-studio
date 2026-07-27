"""
Tests for the grid-to-embroidery converter service.

Tests focus on round-trip verification: convert → export → read back,
rather than inspecting pyembroidery's internal stitch representation.
"""

import tempfile
from pathlib import Path

import pyembroidery
import pytest

from src.services.converter import (
    SUPPORTED_FORMATS,
    export_bytes,
    get_format_info,
    grid_to_pattern,
    hex_to_rgb,
)


class TestHexToRgb:
    """Tests for hex_to_rgb conversion."""

    def test_with_hash(self):
        assert hex_to_rgb("#ff0000") == (255, 0, 0)

    def test_without_hash(self):
        assert hex_to_rgb("00ff00") == (0, 255, 0)

    def test_blue(self):
        assert hex_to_rgb("#0000ff") == (0, 0, 255)

    def test_white(self):
        assert hex_to_rgb("#ffffff") == (255, 255, 255)

    def test_black(self):
        assert hex_to_rgb("#000000") == (0, 0, 0)


def _make_cell(color: str, dmc_code: str = "", dmc_name: str = "") -> dict:
    return {"color": color, "dmcCode": dmc_code, "dmcName": dmc_name}


def _export_and_read(
    grid: list[list[dict]],
    palette: list[dict],
    fmt: str,
) -> pyembroidery.EmbPattern:
    """Helper: convert grid → export to format → read back with pyembroidery."""
    pattern = grid_to_pattern(grid, palette)
    data = export_bytes(pattern, fmt)
    suffix = SUPPORTED_FORMATS[fmt]["extension"]
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp.write(data)
        tmp_path = tmp.name
    try:
        return pyembroidery.read(tmp_path)
    finally:
        Path(tmp_path).unlink(missing_ok=True)


def _count_readable_stitches(read_pattern: pyembroidery.EmbPattern) -> int:
    """Count actual stitch commands (not jumps/trims/color-changes) in a read-back pattern."""
    count = 0
    for stitch in read_pattern.stitches:
        cmd = stitch[2] & 0xFF
        # pyembroidery read-back: STITCH=0, others are non-stitch commands
        if cmd == 0:
            count += 1
    return count


class TestGridToPattern:
    """Tests for grid_to_pattern — verify via round-trip."""

    def test_empty_grid_raises(self):
        with pytest.raises(ValueError, match="non-empty"):
            grid_to_pattern([], [])

    def test_empty_first_row_raises(self):
        with pytest.raises(ValueError, match="non-empty"):
            grid_to_pattern([[]], [])

    def test_single_red_cell_dst_roundtrip(self):
        """A single red cell should export to DST and be readable."""
        grid = [[_make_cell("#ff0000")]]
        palette = [{"code": "DMC 321", "name": "Red", "hex": "#ff0000", "count": 1}]
        read_back = _export_and_read(grid, palette, "dst")
        assert len(read_back.stitches) > 0

    def test_single_red_cell_pes_roundtrip(self):
        """A single red cell should export to PES and be readable."""
        grid = [[_make_cell("#ff0000")]]
        palette = [{"code": "DMC 321", "name": "Red", "hex": "#ff0000", "count": 1}]
        read_back = _export_and_read(grid, palette, "pes")
        assert len(read_back.stitches) > 0

    def test_2x2_checkerboard_dst_roundtrip(self):
        """A 2x2 checkerboard should produce readable DST with stitches."""
        grid = [
            [_make_cell("#ff0000"), _make_cell("#0000ff")],
            [_make_cell("#0000ff"), _make_cell("#ff0000")],
        ]
        palette = [
            {"code": "DMC 321", "name": "Red", "hex": "#ff0000", "count": 2},
            {"code": "DMC 796", "name": "Blue", "hex": "#0000ff", "count": 2},
        ]
        read_back = _export_and_read(grid, palette, "dst")
        assert len(read_back.stitches) >= 2  # at minimum, 2 stitches

    def test_2x2_checkerboard_pes_roundtrip(self):
        """A 2x2 checkerboard should produce readable PES with stitches."""
        grid = [
            [_make_cell("#ff0000"), _make_cell("#0000ff")],
            [_make_cell("#0000ff"), _make_cell("#ff0000")],
        ]
        palette = [
            {"code": "DMC 321", "name": "Red", "hex": "#ff0000", "count": 2},
            {"code": "DMC 796", "name": "Blue", "hex": "#0000ff", "count": 2},
        ]
        read_back = _export_and_read(grid, palette, "pes")
        assert len(read_back.stitches) >= 2

    def test_white_cells_reduce_output(self):
        """A grid with white cells should produce fewer stitches than a full grid."""
        # Full 4x4 grid (all red = 16 stitches)
        grid_full = [[_make_cell("#ff0000") for _ in range(4)] for _ in range(4)]
        palette = [{"code": "DMC 321", "name": "Red", "hex": "#ff0000", "count": 16}]
        full_pattern = grid_to_pattern(grid_full, palette)
        full_data = export_bytes(full_pattern, "dst")

        # Half-white 4x4 grid (every other cell = 8 stitches)
        grid_half = []
        for row in range(4):
            grid_row = []
            for col in range(4):
                if (row + col) % 2 == 0:
                    grid_row.append(_make_cell("#ff0000"))
                else:
                    grid_row.append(_make_cell("#ffffff"))
            grid_half.append(grid_row)
        half_palette = [{"code": "DMC 321", "name": "Red", "hex": "#ff0000", "count": 8}]
        half_pattern = grid_to_pattern(grid_half, half_palette)
        half_data = export_bytes(half_pattern, "dst")

        # Full grid should produce more data (more stitches = larger file)
        assert len(full_data) > len(half_data)

    def test_50x50_grid_dst_export(self):
        """A 50x50 grid should export successfully to DST."""
        size = 50
        grid = [[_make_cell("#ff0000") for _ in range(size)] for _ in range(size)]
        palette = [{"code": "DMC 321", "name": "Red", "hex": "#ff0000", "count": size * size}]
        pattern = grid_to_pattern(grid, palette)
        data = export_bytes(pattern, "dst")
        assert isinstance(data, bytes)
        assert len(data) > 0

    def test_50x50_grid_pes_export(self):
        """A 50x50 grid should export successfully to PES."""
        size = 50
        grid = [[_make_cell("#ff0000") for _ in range(size)] for _ in range(size)]
        palette = [{"code": "DMC 321", "name": "Red", "hex": "#ff0000", "count": size * size}]
        pattern = grid_to_pattern(grid, palette)
        data = export_bytes(pattern, "pes")
        assert isinstance(data, bytes)
        assert len(data) > 0

    def test_16x16_known_output_roundtrip(self):
        """A 16x16 checkerboard should produce valid DST output."""
        size = 16
        grid = []
        for row in range(size):
            grid_row = []
            for col in range(size):
                if (row + col) % 2 == 0:
                    grid_row.append(_make_cell("#ff0000"))
                else:
                    grid_row.append(_make_cell("#ffffff"))
            grid.append(grid_row)

        palette = [{"code": "DMC 321", "name": "Red", "hex": "#ff0000", "count": 128}]
        read_back = _export_and_read(grid, palette, "dst")
        # Should have stitches in the read-back
        assert len(read_back.stitches) > 0

    def test_multi_color_palette_order(self):
        """Verify that multi-color patterns export correctly."""
        grid = [
            [_make_cell("#0000ff"), _make_cell("#ff0000"), _make_cell("#00ff00")],
            [_make_cell("#00ff00"), _make_cell("#0000ff"), _make_cell("#ff0000")],
            [_make_cell("#ff0000"), _make_cell("#00ff00"), _make_cell("#0000ff")],
        ]
        palette = [
            {"code": "DMC 321", "name": "Red", "hex": "#ff0000", "count": 3},
            {"code": "DMC 796", "name": "Blue", "hex": "#0000ff", "count": 3},
            {"code": "DMC 909", "name": "Green", "hex": "#00ff00", "count": 3},
        ]
        # Should not error
        pattern = grid_to_pattern(grid, palette)
        data = export_bytes(pattern, "dst")
        assert len(data) > 0
        data_pes = export_bytes(pattern, "pes")
        assert len(data_pes) > 0

    def test_invalid_grid_non_rectangular(self):
        """Non-rectangular grids should produce a pattern (converter doesn't validate shape)."""
        grid = [
            [_make_cell("#ff0000"), _make_cell("#0000ff")],
            [_make_cell("#00ff00")],  # shorter row
        ]
        palette = [
            {"code": "DMC 321", "name": "Red", "hex": "#ff0000", "count": 1},
            {"code": "DMC 796", "name": "Blue", "hex": "#0000ff", "count": 1},
            {"code": "DMC 909", "name": "Green", "hex": "#00ff00", "count": 1},
        ]
        # Should not crash (shape validation is the API's job)
        pattern = grid_to_pattern(grid, palette)
        data = export_bytes(pattern, "dst")
        assert len(data) > 0


class TestExportBytes:
    """Tests for export_bytes function."""

    def test_export_dst_produces_binary(self):
        """Export a simple pattern to DST and verify it's non-empty binary."""
        grid = [[_make_cell("#ff0000")]]
        palette = [{"code": "DMC 321", "name": "Red", "hex": "#ff0000", "count": 1}]
        pattern = grid_to_pattern(grid, palette)
        data = export_bytes(pattern, "dst")
        assert isinstance(data, bytes)
        assert len(data) > 0

    def test_export_pes_produces_binary(self):
        """Export a simple pattern to PES and verify it's non-empty binary."""
        grid = [[_make_cell("#ff0000")]]
        palette = [{"code": "DMC 321", "name": "Red", "hex": "#ff0000", "count": 1}]
        pattern = grid_to_pattern(grid, palette)
        data = export_bytes(pattern, "pes")
        assert isinstance(data, bytes)
        assert len(data) > 0

    def test_export_invalid_format_raises(self):
        """Exporting to an unsupported format should raise ValueError."""
        grid = [[_make_cell("#ff0000")]]
        palette = [{"code": "DMC 321", "name": "Red", "hex": "#ff0000", "count": 1}]
        pattern = grid_to_pattern(grid, palette)
        with pytest.raises(ValueError, match="Unsupported format"):
            export_bytes(pattern, "xyz")

    def test_exported_dst_readable(self):
        """Verify pyembroidery can read back a DST file we generated."""
        size = 5
        grid = []
        for row in range(size):
            grid_row = []
            for col in range(size):
                grid_row.append(_make_cell("#ff0000" if (row + col) % 2 == 0 else "#0000ff"))
            grid.append(grid_row)
        palette = [
            {"code": "DMC 321", "name": "Red", "hex": "#ff0000", "count": 13},
            {"code": "DMC 796", "name": "Blue", "hex": "#0000ff", "count": 12},
        ]
        read_back = _export_and_read(grid, palette, "dst")
        assert len(read_back.stitches) > 0

    def test_exported_pes_readable(self):
        """Verify pyembroidery can read back a PES file we generated."""
        size = 5
        grid = []
        for row in range(size):
            grid_row = []
            for col in range(size):
                grid_row.append(_make_cell("#ff0000" if (row + col) % 2 == 0 else "#0000ff"))
            grid.append(grid_row)
        palette = [
            {"code": "DMC 321", "name": "Red", "hex": "#ff0000", "count": 13},
            {"code": "DMC 796", "name": "Blue", "hex": "#0000ff", "count": 12},
        ]
        read_back = _export_and_read(grid, palette, "pes")
        assert len(read_back.stitches) > 0

    def test_exported_dst_has_valid_header(self):
        """DST files should start with the 'LA:' header."""
        size = 5
        grid = [[_make_cell("#ff0000") for _ in range(size)] for _ in range(size)]
        palette = [{"code": "DMC 321", "name": "Red", "hex": "#ff0000", "count": size * size}]
        pattern = grid_to_pattern(grid, palette)
        data = export_bytes(pattern, "dst")

        # DST header starts with "LA:"
        header = data[:16].decode("ascii", errors="replace")
        assert "LA:" in header

    def test_exported_pes_has_valid_header(self):
        """PES files should start with the '#PES' magic bytes."""
        size = 5
        grid = [[_make_cell("#ff0000") for _ in range(size)] for _ in range(size)]
        palette = [{"code": "DMC 321", "name": "Red", "hex": "#ff0000", "count": size * size}]
        pattern = grid_to_pattern(grid, palette)
        data = export_bytes(pattern, "pes")

        # PES header starts with "#PES"
        header = data[:4].decode("ascii", errors="replace")
        assert "#PES" in header


class TestGetFormatInfo:
    """Tests for get_format_info."""

    def test_returns_dst_and_pes(self):
        info = get_format_info()
        assert "dst" in info["formats"]
        assert "pes" in info["formats"]
        assert info["default"] == "dst"


class TestSupportedFormats:
    """Tests for SUPPORTED_FORMATS constant."""

    def test_dst_extension(self):
        assert SUPPORTED_FORMATS["dst"]["extension"] == ".dst"

    def test_pes_extension(self):
        assert SUPPORTED_FORMATS["pes"]["extension"] == ".pes"
