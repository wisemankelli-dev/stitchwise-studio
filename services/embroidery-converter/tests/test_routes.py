"""
Tests for the embroidery converter API routes.
"""

import pytest
from fastapi.testclient import TestClient

from src.app import app

client = TestClient(app)


class TestHealth:
    """Tests for the health endpoint."""

    def test_health_returns_ok(self):
        response = client.get("/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        assert data["service"] == "embroidery-converter"


class TestFormats:
    """Tests for the formats endpoint."""

    def test_formats_returns_dst_and_pes(self):
        response = client.get("/api/formats")
        assert response.status_code == 200
        data = response.json()
        assert "dst" in data["formats"]
        assert "pes" in data["formats"]
        assert data["default"] == "dst"


class TestConvert:
    """Tests for the convert endpoint."""

    def _make_cell(self, color: str, dmc_code: str = "", dmc_name: str = "") -> dict:
        return {"color": color, "dmcCode": dmc_code, "dmcName": dmc_name}

    def _make_palette(self, entries: list[tuple]) -> list[dict]:
        return [
            {"code": code, "name": name, "hex": hex_color, "count": count}
            for code, name, hex_color, count in entries
        ]

    def test_convert_simple_grid_to_dst(self):
        """Convert a simple 2x2 grid to DST."""
        grid = [
            [self._make_cell("#ff0000"), self._make_cell("#ff0000")],
            [self._make_cell("#ff0000"), self._make_cell("#ff0000")],
        ]
        palette = self._make_palette([("DMC 321", "Red", "#ff0000", 4)])

        response = client.post(
            "/api/convert",
            json={"grid": grid, "format": "dst", "dmcPalette": palette},
        )
        assert response.status_code == 200
        assert response.headers["content-type"] == "application/octet-stream"
        assert "attachment" in response.headers["content-disposition"]
        assert len(response.content) > 0

    def test_convert_simple_grid_to_pes(self):
        """Convert a simple 2x2 grid to PES."""
        grid = [
            [self._make_cell("#ff0000"), self._make_cell("#ff0000")],
            [self._make_cell("#ff0000"), self._make_cell("#ff0000")],
        ]
        palette = self._make_palette([("DMC 321", "Red", "#ff0000", 4)])

        response = client.post(
            "/api/convert",
            json={"grid": grid, "format": "pes", "dmcPalette": palette},
        )
        assert response.status_code == 200
        assert response.headers["content-type"] == "application/octet-stream"
        assert len(response.content) > 0

    def test_convert_default_format_is_dst(self):
        """When no format specified, default to DST."""
        grid = [[self._make_cell("#ff0000")]]
        palette = self._make_palette([("DMC 321", "Red", "#ff0000", 1)])

        response = client.post(
            "/api/convert",
            json={"grid": grid, "dmcPalette": palette},
        )
        assert response.status_code == 200

    def test_convert_unsupported_format(self):
        """Requesting an unsupported format should return 400."""
        grid = [[self._make_cell("#ff0000")]]
        palette = self._make_palette([("DMC 321", "Red", "#ff0000", 1)])

        response = client.post(
            "/api/convert",
            json={"grid": grid, "format": "xyz", "dmcPalette": palette},
        )
        assert response.status_code == 400
        assert "Unsupported format" in response.json()["detail"]

    def test_convert_empty_grid(self):
        """An empty grid should return 400."""
        response = client.post(
            "/api/convert",
            json={"grid": [], "format": "dst", "dmcPalette": []},
        )
        assert response.status_code == 400

    def test_convert_non_rectangular_grid(self):
        """A non-rectangular grid should return 400."""
        grid = [
            [self._make_cell("#ff0000"), self._make_cell("#ff0000")],
            [self._make_cell("#ff0000")],  # only 1 cell
        ]
        palette = self._make_palette([("DMC 321", "Red", "#ff0000", 3)])

        response = client.post(
            "/api/convert",
            json={"grid": grid, "format": "dst", "dmcPalette": palette},
        )
        assert response.status_code == 400

    def test_convert_with_white_cells(self):
        """A grid with white cells should produce valid output."""
        grid = [
            [self._make_cell("#ff0000"), self._make_cell("#ffffff")],
            [self._make_cell("#ffffff"), self._make_cell("#ff0000")],
        ]
        palette = self._make_palette([("DMC 321", "Red", "#ff0000", 2)])

        response = client.post(
            "/api/convert",
            json={"grid": grid, "format": "dst", "dmcPalette": palette},
        )
        assert response.status_code == 200
        assert len(response.content) > 0

    def test_convert_dst_has_correct_headers(self):
        """DST output should have proper headers."""
        grid = [[self._make_cell("#ff0000")]]
        palette = self._make_palette([("DMC 321", "Red", "#ff0000", 1)])

        response = client.post(
            "/api/convert",
            json={"grid": grid, "format": "dst", "dmcPalette": palette},
        )
        assert response.status_code == 200
        # DST files start with "LA:"
        header = response.content[:16].decode("ascii", errors="replace")
        assert "LA:" in header

    def test_convert_pes_has_correct_headers(self):
        """PES output should have proper headers."""
        grid = [[self._make_cell("#ff0000")]]
        palette = self._make_palette([("DMC 321", "Red", "#ff0000", 1)])

        response = client.post(
            "/api/convert",
            json={"grid": grid, "format": "pes", "dmcPalette": palette},
        )
        assert response.status_code == 200
        # PES files start with "#PES"
        header = response.content[:4].decode("ascii", errors="replace")
        assert "#PES" in header

    def test_root_endpoint(self):
        """The root endpoint should return service info."""
        response = client.get("/")
        assert response.status_code == 200
        data = response.json()
        assert data["service"] == "StitchWise Embroidery Converter Service"
        assert "docs" in data
