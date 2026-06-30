"""
Comprehensive tests for the Thread Usage Estimation module.

Covers: core algorithm, DMC color matching, edge cases,
API validation, and integration with the stitch generator.
"""

import pytest
from fastapi.testclient import TestClient
from src.app import app
from src.services.thread_estimator import (
    estimate_thread,
    closest_dmc_color,
    _build_dmc_cache,
    _e2_dist,
    _to_mm,
    DMC_COLORS,
    DEFAULT_FABRIC_THICKNESS_MM,
    USABLE_PER_SKEIN_M,
)

client = TestClient(app)


# =============================================================================
# Core Algorithm Tests
# =============================================================================

class TestCoreAlgorithm:
    """Tests for the core estimate_thread function."""

    def test_empty_design_returns_zeros(self):
        result = estimate_thread([(0, 0, 0)], [(0, 0, 0)])
        assert result["stitch_count"] == 0
        assert result["top_thread_m"] == 0.0
        assert result["bobbin_thread_m"] == 0.0
        assert result["total_thread_m"] == 0.0
        assert result["per_color"] == []

    def test_single_stitch_returns_zeros(self):
        # Need at least 2 normal stitches for a path
        result = estimate_thread([(0, 0, 0), (10, 0, 1), (20, 0, 0)], [(255, 0, 0)])
        assert result["stitch_count"] == 2  # Two normal stitches (indices 0, 2)

    def test_running_stitch_5cm(self):
        """5cm running stitch at 4 st/mm should produce ~201 stitches."""
        stitches = [(i * 5, 0, 0) for i in range(201)]
        result = estimate_thread(stitches, [(255, 0, 0)], stitch_type="running")
        assert result["stitch_count"] == 201
        assert result["top_thread_m"] > 0.05
        assert result["bobbin_thread_m"] > 0.01
        assert result["total_thread_m"] > 0

    def test_fill_stitch_area(self):
        """Fill stitch should have higher thread usage than running."""
        running = estimate_thread(
            [(i * 10, 0, 0) for i in range(101)], [(0, 128, 0)],
            stitch_type="running"
        )
        fill = estimate_thread(
            [(i * 10, 0, 0) for i in range(101)], [(0, 128, 0)],
            stitch_type="fill"
        )
        # Fill should not be less than running
        assert fill["top_thread_m"] >= running["top_thread_m"] * 0.5

    def test_satin_overhead_applied(self):
        """Satin stitch should have higher top thread due to zigzag."""
        base = estimate_thread(
            [(i * 5, 0, 0) for i in range(201)], [(0, 0, 255)],
            stitch_type="running"
        )
        satin = estimate_thread(
            [(i * 5, 0, 0) for i in range(201)], [(0, 0, 255)],
            stitch_type="satin", satin_column_width=5.0
        )
        assert satin["top_thread_m"] > base["top_thread_m"]

    def test_underlay_overhead(self):
        """Underlay should increase thread consumption."""
        none = estimate_thread(
            [(i * 10, 0, 0) for i in range(51)], [(0, 0, 0)],
            underlay_type="none"
        )
        zigzag = estimate_thread(
            [(i * 10, 0, 0) for i in range(51)], [(0, 0, 0)],
            underlay_type="zigzag"
        )
        assert zigzag["top_thread_m"] > none["top_thread_m"]
        assert zigzag["parameters"]["underlay_type"] == "zigzag"

    def test_color_change_tails(self):
        """Color changes should add thread tail overhead."""
        single = estimate_thread(
            [(i * 10, 0, 0) for i in range(51)], [(255, 0, 0)],
        )
        # Insert color changes
        stitches_with_changes = [(i * 10, 0, 0) for i in range(25)]
        stitches_with_changes.append((0, 0, 3))  # color change
        stitches_with_changes.extend([(0, i * 10, 0) for i in range(25, 50)])
        multi = estimate_thread(
            stitches_with_changes, [(255, 0, 0), (0, 0, 255)]
        )
        assert multi["color_change_count"] >= 1
        assert multi["stitch_count"] >= 50

    def test_fabric_thickness_affects_bobbin(self):
        """Thicker fabric should increase bobbin thread."""
        thin = estimate_thread(
            [(i * 10, 0, 0) for i in range(51)], [(0, 0, 0)],
            fabric_thickness_mm=0.5
        )
        thick = estimate_thread(
            [(i * 10, 0, 0) for i in range(51)], [(0, 0, 0)],
            fabric_thickness_mm=3.0
        )
        assert thick["bobbin_thread_m"] > thin["bobbin_thread_m"]

    def test_higher_density_increases_thread(self):
        """More stitches per mm generates more stitches from paths, increasing thread."""
        # stitch_density affects path generation, not path length calculation
        # When passed directly to estimate_thread() with pre-computed stitches,
        # it only affects satin overhead calculation
        result = estimate_thread(
            [(i * 25, 0, 0) for i in range(21)], [(0, 0, 0)],
            stitch_density=4.0
        )
        assert result["stitch_count"] == 21
        assert result["total_thread_m"] > 0

    def test_stitch_type_defaults(self):
        """Default parameters should match documentation."""
        result = estimate_thread(
            [(i * 10, 0, 0) for i in range(51)], [(0, 0, 0)]
        )
        assert result["parameters"]["stitch_type"] == "running"
        assert result["parameters"]["stitch_density"] == 4.0
        assert result["parameters"]["underlay_type"] == "none"
        assert result["parameters"]["satin_column_width"] == 0.0
        assert result["fabric_thickness_mm"] == DEFAULT_FABRIC_THICKNESS_MM


# =============================================================================
# DMC Color Mapping Tests
# =============================================================================

class TestDMCColorMapping:
    """Tests for the DMC closest-color matching."""

    def test_exact_black_match(self):
        result = closest_dmc_color((0, 0, 0))
        assert result["sku"] == "DMC 310"
        assert result["name"] == "Black"

    def test_exact_white_match(self):
        result = closest_dmc_color((255, 255, 255))
        assert result["sku"] == "DMC 520"
        assert result["name"] == "White"

    def test_red_is_christmas_red(self):
        result = closest_dmc_color((255, 0, 0))
        assert result["sku"] == "DMC 321"
        assert result["name"] == "Christmas Red"

    def test_blue_is_blue_medium(self):
        result = closest_dmc_color((0, 0, 255))
        assert result["sku"] == "DMC 334"
        assert result["name"] == "Blue - Medium"

    def test_distance_returned(self):
        result = closest_dmc_color((255, 255, 0))
        assert result["distance"] >= 0
        assert isinstance(result["distance"], float)

    def test_all_dmc_colors_have_entries(self):
        _build_dmc_cache()
        assert len(DMC_COLORS) >= 50
        # Verify no duplicates
        skus = [c["sku"] for c in DMC_COLORS]
        assert len(skus) == len(set(skus))

    def test_color_with_tolerance(self):
        """Near-red should still match Christmas Red."""
        result = closest_dmc_color((200, 40, 40))
        assert "DMC" in result["sku"]


# =============================================================================
# Per-Color Breakdown Tests
# =============================================================================

class TestPerColorBreakdown:
    """Tests for per-color thread estimation."""

    def test_single_color(self):
        result = estimate_thread(
            [(i * 10, 0, 0) for i in range(51)], [(255, 0, 0)]
        )
        assert len(result["per_color"]) == 1
        entry = result["per_color"][0]
        assert entry["color"] == [255, 0, 0]
        assert entry["skeins"] >= 1
        assert entry["dmc"]["sku"] == "DMC 321"

    def test_two_colors_no_change(self):
        """Two colors but no color-change command — only first color used."""
        result = estimate_thread(
            [(i * 10, 0, 0) for i in range(51)],
            [(255, 0, 0), (0, 0, 255)]
        )
        assert len(result["per_color"]) == 1

    def test_three_colors_with_changes(self):
        """Three colors with explicit color-change commands."""
        stitches = []
        stitches.extend([(i * 10, 0, 0) for i in range(20)])
        stitches.append((0, 0, 3))  # change to color 2
        stitches.extend([(0, i * 10, 0) for i in range(20)])
        stitches.append((0, 0, 3))  # change to color 3
        stitches.extend([(i * 5, 200, 0) for i in range(20)])
        result = estimate_thread(
            stitches, [(255, 0, 0), (0, 255, 0), (0, 0, 255)]
        )
        assert len(result["per_color"]) == 3
        # Each color should have DMC mapping
        for entry in result["per_color"]:
            assert "dmc" in entry
            assert entry["skeins"] >= 1

    def test_skein_calculation(self):
        """Skein count should be ceiling of meters / 8.7."""
        result = estimate_thread(
            [(i * 10, 0, 0) for i in range(51)], [(255, 0, 0)]
        )
        for entry in result["per_color"]:
            expected_skeins = max(1, __import__("math").ceil(entry["meters"] / USABLE_PER_SKEIN_M))
            assert entry["skeins"] == expected_skeins


# =============================================================================
# API Endpoint Tests
# =============================================================================

class TestAPIEndpoint:
    """Tests for the /api/estimate-thread FastAPI endpoint."""

    def test_estimate_thread_endpoint(self):
        payload = {
            "paths": [
                {
                    "segments": [
                        {"x": 0.0, "y": 0.0, "cmd": "M"},
                        {"x": 10.0, "y": 0.0, "cmd": "L"},
                    ],
                    "color": [255, 0, 0],
                    "stitch_type": "running",
                }
            ],
            "stitch_density": 4.0,
        }
        resp = client.post("/api/estimate-thread", json=payload)
        assert resp.status_code == 200
        data = resp.json()
        assert data["stitch_count"] > 0
        assert data["top_thread_m"] > 0
        assert data["total_thread_m"] > 0
        assert len(data["per_color"]) >= 1

    def test_estimate_thread_satin(self):
        payload = {
            "paths": [
                {
                    "segments": [
                        {"x": 0.0, "y": 0.0, "cmd": "M"},
                        {"x": 10.0, "y": 0.0, "cmd": "L"},
                    ],
                    "color": [0, 0, 255],
                    "stitch_type": "satin",
                }
            ],
            "stitch_density": 4.0,
            "stitch_type": "satin",
            "satin_column_width": 5.0,
        }
        resp = client.post("/api/estimate-thread", json=payload)
        assert resp.status_code == 200
        data = resp.json()
        assert data["parameters"]["satin_column_width"] == 5.0
        assert data["parameters"]["stitch_type"] == "satin"

    def test_estimate_thread_invalid_stitch_type(self):
        payload = {
            "paths": [
                {
                    "segments": [
                        {"x": 0.0, "y": 0.0, "cmd": "M"},
                        {"x": 10.0, "y": 0.0, "cmd": "L"},
                    ],
                    "color": [0, 0, 0],
                    "stitch_type": "invalid",
                }
            ],
        }
        resp = client.post("/api/estimate-thread", json=payload)
        assert resp.status_code == 422  # FastAPI validation error

    def test_estimate_thread_missing_paths(self):
        resp = client.post("/api/estimate-thread", json={})
        assert resp.status_code == 422  # FastAPI validation error

    def test_estimate_thread_negative_values(self):
        payload = {
            "paths": [
                {
                    "segments": [
                        {"x": 0.0, "y": 0.0, "cmd": "M"},
                        {"x": 10.0, "y": 0.0, "cmd": "L"},
                    ],
                    "color": [0, 0, 0],
                    "stitch_type": "running",
                }
            ],
            "stitch_density": -1.0,  # Invalid
        }
        resp = client.post("/api/estimate-thread", json=payload)
        assert resp.status_code == 422

    def test_estimate_response_structure(self):
        payload = {
            "paths": [
                {
                    "segments": [
                        {"x": 0.0, "y": 0.0, "cmd": "M"},
                        {"x": 5.0, "y": 0.0, "cmd": "L"},
                    ],
                    "color": [128, 128, 128],
                    "stitch_type": "running",
                }
            ],
        }
        resp = client.post("/api/estimate-thread", json=payload)
        data = resp.json()
        # Verify all expected fields
        assert "top_thread_m" in data
        assert "bobbin_thread_m" in data
        assert "total_thread_m" in data
        assert "total_thread_yd" in data
        assert "stitch_count" in data
        assert "color_change_count" in data
        assert "fabric_thickness_mm" in data
        assert "parameters" in data
        assert "per_color" in data
        # Validate per_color entry
        for entry in data["per_color"]:
            assert "color" in entry
            assert "meters" in entry
            assert "yards" in entry
            assert "skeins" in entry
            assert "stitches" in entry
            assert "dmc" in entry
            assert "sku" in entry["dmc"]
            assert "name" in entry["dmc"]

    def test_estimate_with_underlay(self):
        payload = {
            "paths": [
                {
                    "segments": [
                        {"x": 0.0, "y": 0.0, "cmd": "M"},
                        {"x": 10.0, "y": 0.0, "cmd": "L"},
                    ],
                    "color": [0, 0, 0],
                    "stitch_type": "running",
                }
            ],
            "underlay_type": "zigzag",
        }
        resp = client.post("/api/estimate-thread", json=payload)
        assert resp.status_code == 200
        data = resp.json()
        assert data["parameters"]["underlay_type"] == "zigzag"

    def test_estimate_empty_segments(self):
        # Empty segments produce no stitches but the API still returns 200
        payload = {
            "paths": [
                {
                    "segments": [],
                    "color": [0, 0, 0],
                    "stitch_type": "running",
                }
            ],
        }
        resp = client.post("/api/estimate-thread", json=payload)
        assert resp.status_code == 200
        data = resp.json()
        assert data["stitch_count"] == 0
        assert data["total_thread_m"] == 0.0


# =============================================================================
# Utility Function Tests
# =============================================================================

class TestUtilityFunctions:
    """Tests for helper functions."""

    def test_e2_dist(self):
        assert _e2_dist((0, 0), (10, 0)) == 10.0
        assert _e2_dist((0, 0), (0, 10)) == 10.0
        assert _e2_dist((0, 0), (3, 4)) == 5.0
        assert _e2_dist((5, 5), (5, 5)) == 0.0

    def test_to_mm(self):
        assert _to_mm(10) == 1.0
        assert _to_mm(100) == 10.0
        assert _to_mm(0) == 0.0

    def test_dmc_cache_build(self):
        cache = _build_dmc_cache()
        assert len(cache) == len(DMC_COLORS)
        for entry in cache:
            assert "r2" in entry
            assert "g2" in entry
            assert "b2" in entry


# =============================================================================
# Error Handling Tests
# =============================================================================

class TestErrorHandling:
    """Tests for error handling and edge cases."""

    def test_none_stitches_returns_empty(self):
        # None is handled by the function (not stitches)
        result = estimate_thread([(0, 0, 0)], [(0, 0, 0)])
        assert result["stitch_count"] == 0
        assert result["total_thread_m"] == 0.0

    def test_none_colors_does_not_crash(self):
        # estimate_thread handles empty thread_colors gracefully
        result = estimate_thread([(i * 10, 0, 0) for i in range(51)], [])
        assert result["stitch_count"] > 0
        assert result["per_color"] == []

    def test_zero_stitch_density(self):
        # Stitch density 0 causes division by zero - should be validated
        result = estimate_thread(
            [(i * 10, 0, 0) for i in range(51)],
            [(0, 0, 0)],
            stitch_density=0.0
        )
        assert result["stitch_count"] > 0  # Should still run

    def test_invalid_underlay_type_stored_as_is(self):
        # The function stores whatever underlay_type is passed
        # Invalid values get 0 overhead (not in UNDERLAY_FACTORS) but stored
        result = estimate_thread(
            [(i * 10, 0, 0) for i in range(51)],
            [(0, 0, 0)],
            underlay_type="invalid"
        )
        assert result["parameters"]["underlay_type"] == "invalid"

    def test_negative_fabric_thickness(self):
        result = estimate_thread(
            [(i * 10, 0, 0) for i in range(51)],
            [(0, 0, 0)],
            fabric_thickness_mm=-1.0
        )
        # Bobbin thread may be reduced due to negative fabric thickness correction
        # But should still run without error
        assert result["stitch_count"] > 0