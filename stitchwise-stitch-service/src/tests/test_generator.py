"""
Unit tests for the stitch generator service.
"""

from src.services.stitch_generator import (
    StitchPattern,
    generate_stitches_from_svg_paths,
    export_pattern,
    get_format_info,
)


class TestStitchPattern:
    def test_empty_pattern(self):
        pattern = StitchPattern()
        assert len(pattern.stitches) == 0
        assert len(pattern.thread_colors) == 0

    def test_add_stitches(self):
        pattern = StitchPattern()
        pattern.add_stitch(10, 20)
        pattern.add_stitch(30, 40)
        assert len(pattern.stitches) == 2
        assert pattern.stitches[0] == (10, 20, 0)
        assert pattern.stitches[1] == (30, 40, 0)

    def test_color_change(self):
        pattern = StitchPattern()
        pattern.add_color_change((255, 0, 0))
        assert len(pattern.thread_colors) == 1
        assert pattern.thread_colors[0] == (255, 0, 0)

    def test_jump_stitch(self):
        pattern = StitchPattern()
        pattern.add_jump(100, 100)
        assert len(pattern.stitches) == 1
        assert pattern.stitches[0] == (100, 100, 1)


class TestGenerateStitches:
    def test_single_line_running(self):
        paths = [
            {
                "segments": [
                    (0.0, 0.0, "M"),
                    (10.0, 0.0, "L"),
                ],
                "color": (0, 0, 0),
                "type": "running",
            }
        ]
        pattern = generate_stitches_from_svg_paths(paths, stitch_density=10.0)
        assert len(pattern.stitches) > 0
        assert len(pattern.thread_colors) == 1

    def test_empty_paths(self):
        pattern = generate_stitches_from_svg_paths([], stitch_density=4.0)
        assert len(pattern.stitches) == 0


class TestExport:
    def test_export_to_dst(self):
        pattern = StitchPattern()
        pattern.add_color_change((0, 0, 0))
        pattern.add_stitch(0, 0)
        pattern.add_stitch(100, 0)
        pattern.add_stitch(100, 100)

        result = export_pattern(pattern, "dst")
        assert len(result) > 0
        # DST files are binary and non-empty; verify it's a valid embroidery file
        assert len(result) > 50  # DST files have a minimum size

    def test_export_unsupported_format(self):
        pattern = StitchPattern()
        try:
            export_pattern(pattern, "xyz")
            assert False, "Should have raised ValueError"
        except ValueError:
            pass

    def test_get_format_info(self):
        info = get_format_info()
        assert "formats" in info
        assert "dst" in info["formats"]
        assert info["default"] == "dst"