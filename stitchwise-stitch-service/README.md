# StitchWise Stitch Service

Python microservice for generating machine embroidery files (.dst, .pes, .exp, etc.).

## Overview

This service wraps [pyembroidery](https://github.com/EmbroiderPy/pyembroidery) to provide a REST API for:

- **Generating** embroidery files from vector path data (SVG segments → stitch paths)
- **Converting** between embroidery formats (.dst ↔ .pes ↔ .exp ↔ .jef ↔ .vp3)
- **Listing** supported formats and capabilities

## Architecture

```
Node.js Express Backend (port 3000)
        │
        │ HTTP (port 8000)
        ▼
Python Stitch Service (port 8000)
    ├── /api/health — Health check
    ├── /api/formats — List supported formats
    ├── /api/generate — Generate from JSON path data → embroidery file
    └── /api/convert — Convert uploaded embroidery files between formats
```

## Quick Start

```bash
# Install dependencies
pip install -r requirements.txt

# Run in development
python -m src.app

# Run with gunicorn (production)
gunicorn --bind 0.0.0.0:8000 "src.app:create_app()"
```

## API Endpoints

### `GET /api/health`
Returns service status.

### `GET /api/formats`
Lists all supported embroidery formats with descriptions.

### `POST /api/generate`
Generate an embroidery file from SVG path data.

**Request body (JSON):**
```json
{
  "paths": [
    {
      "segments": [
        [0.0, 0.0, "M"],
        [100.0, 0.0, "L"],
        [100.0, 100.0, "L"],
        [0.0, 100.0, "L"],
        [0.0, 0.0, "L"]
      ],
      "color": [255, 0, 0],
      "type": "running"
    }
  ],
  "format": "dst",
  "stitch_density": 4.0
}
```

**Response:** Binary embroidery file download.

### `POST /api/convert`
Upload an embroidery file and convert it to another format.

**Form data:**
- `file` — The embroidery file to convert
- `format` — Target format (e.g., "pes", "dst")

**Response:** Converted embroidery file download.

## Supported Formats

| Code | Format | Machines |
|------|--------|----------|
| dst | Tajima | Industry standard, most commercial |
| pes | Brother/Bernina | Home machines |
| exp | Melco | Commercial |
| jef | Janome | Home machines |
| vp3 | Pfaff/Viking | European brands |
| pxf | Pfaff | Pfaff machines |
| xxx | Singer/Toyota | Home machines |

## Testing

```bash
pytest
```

## Docker

```bash
# Build
docker build -t stitchwise-stitch-service .

# Run
docker run -p 8000:8000 stitchwise-stitch-service
```