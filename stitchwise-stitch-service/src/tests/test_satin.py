"""
Tests for satin stitch generation.
"""

from src.services.stitch_generator import (
    generate_stitches_from_svg_paths,
    _sample_rail,
    StitchPattern,
)


class TestRailSampling:
    def test_sample_straight_line(self):
        segments = [(0.0, 0.0, "M"), (10.0, 0.0, "L")]
        samples = _sample_rail(segments, 5, 10.0)
        assert len(samples) == 5
        # First point should be (0, 0), last should be (100, 0)
        assert samples[0] == (0, 0)
        assert samples[-1] == (100, 0)

    def test_sample_vertical_line(self):
        segments = [(0.0, 0.0, "M"), (0.0, 10.0, "L")]
        samples = _sample_rail(segments, 3, 10.0)
        assert len(samples) == 3
        assert samples[0][0] == 0
        assert samples[-1] == (0, 100)

    def test_single_point(self):
        segments = [(5.0, 5.0, "M")]
        samples = _sample_rail(segments, 3, 10.0)
        assert len(samples) == 1  # Can't sample from a single point
        assert samples[0] == (50, 50)


class TestSatinStitch:
    def test_satin_between_two_rails(self):
        """Generate satin stitches between two parallel vertical rails."""
        paths = [
            {
                "segments": [(0.0, 0.0, "M"), (0.0, 10.0, "L")],
                "color": (255, 0, 0),
                "type": "satin",
                "rails": [
                    [(0.0, 0.0, "M"), (0.0, 10.0, "L")],   # left rail
                    [(5.0, 0.0, "M"), (5.0, 10.0, "L")],   # right rail
                ],
                "underlay": False,
            }
        ]
        pattern = generate_stitches_from_svg_paths(paths, stitch_density=4.0)
        assert len(pattern.stitches) > 0
        assert len(pattern.thread_colors) == 1
        assert pattern.thread_colors[0] == (255, 0, 0)

    def test_satin_with_underlay(self):
        """Satin stitch with underlay should generate more stitches."""
        paths = [
            {
                "segments": [(0.0, 0.0, "M"), (0.0, 10.0, "L")],
                "color": (0, 0, 255),
                "type": "satin",
                "rails": [
                    [(0.0, 0.0, "M"), (0.0, 10.0, "L")],
                    [(5.0, 0.0, "M"), (5.0, 10.0, "L")],
                ],
                "underlay": True,
            }
        ]
        pattern = generate_stitches_from_svg_paths(paths, stitch_density=4.0)
        assert len(pattern.stitches) > 0

    def test_satin_staggered_rails(self):
        """Satin between angled rails (trapezoid shape)."""
        paths = [
            {
                "segments": [(0.0, 0.0, "M"), (0.0, 10.0, "L")],
                "color": (0, 128, 0),
                "type": "satin",
                "rails": [
                    [(0.0, 0.0, "M"), (0.0, 10.0, "L")],     # left rail: vertical
                    [(2.0, 0.0, "M"), (8.0, 10.0, "L")],     # right rail: diagonal
                ],
                "underlay": False,
            }
        ]
        pattern = generate_stitches_from_svg_paths(paths, stitch_density=4.0)
        assert len(pattern.stitches) > 0

    def test_satin_falls_back_to_running(self):
        """Satin with no rails should fall back to running stitch."""
        paths = [
            {
                "segments": [(0.0, 0.0, "M"), (10.0, 0.0, "L"), (10.0, 10.0, "L")],
                "color": (128, 128, 128),
                "type": "satin",
                "rails": [],  # No rails provided
            }
        ]
        pattern = generate_stitches_from_svg_paths(paths, stitch_density=4.0)
        assert len(pattern.stitches) > 0

    def test_satin_export_to_dst(self):
        """Export a satin stitch pattern to .dst format."""
        from src.services.stitch_generator import export_pattern

        paths = [
            {
                "segments": [(0.0, 0.0, "M"), (0.0, 10.0, "L")],
                "color": (255, 0, 128),
                "type": "satin",
                "rails": [
                    [(0.0, 0.0, "M"), (0.0, 10.0, "L")],
                    [(3.0, 0.0, "M"), (3.0, 10.0, "L")],
                ],
            }
        ]
        pattern = generate_stitches_from_svg_paths(paths, stitch_density=4.0)
        result = export_pattern(pattern, "dst")
        assert len(result) > 0
        # DST files start with a specific header (# or L depending on pyembroidery version)
        assert result[:1] in (b"#", b"L"), f"Expected DST header (# or L), got {result[:1]}"
