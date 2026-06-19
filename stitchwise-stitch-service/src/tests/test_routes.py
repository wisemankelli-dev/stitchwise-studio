"""
Tests for the StitchWise Stitch Service FastAPI endpoints.
"""

from fastapi.testclient import TestClient
from src.app import app

client = TestClient(app)


class TestHealth:
    def test_health(self):
        resp = client.get("/api/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "ok"
        assert data["service"] == "stitch-service"

    def test_root(self):
        resp = client.get("/")
        assert resp.status_code == 200
        data = resp.json()
        assert "StitchWise Stitch Service" in data["service"]
        assert "/docs" in data["docs"]


class TestFormats:
    def test_formats(self):
        resp = client.get("/api/formats")
        assert resp.status_code == 200
        data = resp.json()
        assert "formats" in data
        assert "dst" in data["formats"]
        assert "pes" in data["formats"]
        assert data["default"] == "dst"

    def test_format_structure(self):
        resp = client.get("/api/formats")
        data = resp.json()
        dst = data["formats"]["dst"]
        assert "extension" in dst
        assert "description" in dst
        assert dst["extension"] == ".dst"


class TestGenerate:
    def test_generate_requires_paths(self):
        resp = client.post("/api/generate", json={})
        assert resp.status_code == 422  # FastAPI validation error

    def test_generate_simple_running_stitch(self):
        """Generate a simple square as running stitches in .dst format."""
        payload = {
            "paths": [
                {
                    "segments": [
                        {"x": 0.0, "y": 0.0, "cmd": "M"},
                        {"x": 10.0, "y": 0.0, "cmd": "L"},
                        {"x": 10.0, "y": 10.0, "cmd": "L"},
                        {"x": 0.0, "y": 10.0, "cmd": "L"},
                        {"x": 0.0, "y": 0.0, "cmd": "L"},
                    ],
                    "color": [255, 0, 0],
                    "stitch_type": "running",
                }
            ],
            "format": "dst",
            "stitch_density": 4.0,
        }
        resp = client.post("/api/generate", json=payload)
        assert resp.status_code == 200
        assert resp.headers["content-type"] == "application/octet-stream"
        assert len(resp.content) > 0

    def test_generate_invalid_format(self):
        payload = {
            "paths": [
                {
                    "segments": [
                        {"x": 0.0, "y": 0.0, "cmd": "M"},
                        {"x": 10.0, "y": 0.0, "cmd": "L"},
                    ],
                    "color": [0, 0, 255],
                    "stitch_type": "running",
                }
            ],
            "format": "invalid",
        }
        resp = client.post("/api/generate", json=payload)
        # FastAPI validates format length of 3, so invalid will be > 3 chars
        assert resp.status_code == 422

    def test_generate_pes_format(self):
        """Test generating in .pes format."""
        payload = {
            "paths": [
                {
                    "segments": [
                        {"x": 0.0, "y": 0.0, "cmd": "M"},
                        {"x": 5.0, "y": 5.0, "cmd": "L"},
                    ],
                    "color": [0, 0, 0],
                    "stitch_type": "running",
                }
            ],
            "format": "pes",
            "stitch_density": 4.0,
        }
        resp = client.post("/api/generate", json=payload)
        assert resp.status_code == 200
        assert len(resp.content) > 0

    def test_generate_fill_stitch(self):
        """Test fill stitch generation with a triangle."""
        payload = {
            "paths": [
                {
                    "segments": [
                        {"x": 0.0, "y": 0.0, "cmd": "M"},
                        {"x": 10.0, "y": 0.0, "cmd": "L"},
                        {"x": 5.0, "y": 10.0, "cmd": "L"},
                        {"x": 0.0, "y": 0.0, "cmd": "L"},
                    ],
                    "color": [0, 128, 0],
                    "stitch_type": "fill",
                }
            ],
            "format": "dst",
        }
        resp = client.post("/api/generate", json=payload)
        assert resp.status_code == 200
        assert len(resp.content) > 0


class TestConvert:
    def test_convert_no_file(self):
        resp = client.post("/api/convert", data={})
        assert resp.status_code == 422  # FastAPI validation

    def test_convert_invalid_format(self):
        resp = client.post("/api/convert", data={
            "format": "xyz",
        })
        assert resp.status_code == 422  # no file