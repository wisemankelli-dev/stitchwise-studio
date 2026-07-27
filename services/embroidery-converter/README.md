# StitchWise Embroidery Converter Service

Converts StitchCell[][] grid data into machine embroidery files (.dst, .pes).

## Overview

This microservice takes a 2D grid of stitch cells (as produced by the StitchWise pattern editor) and converts them into binary embroidery files that can be loaded onto Tajima (.dst) or Brother (.pes) embroidery machines.

Each cell in the grid = one stitch at 2.0mm spacing.

## Quick Start

```bash
# Install dependencies
pip install -r requirements.txt

# Run the service
uvicorn src.app:app --host 0.0.0.0 --port 8001

# Or with Docker
docker build -t embroidery-converter .
docker run -p 8001:8001 embroidery-converter
```

## API

### `GET /api/health`
Health check endpoint.

### `GET /api/formats`
List supported output formats.

### `POST /api/convert`
Convert a grid to an embroidery file.

**Request body:**
```json
{
  "grid": [
    [
      { "color": "#ff0000", "dmcCode": "DMC 321", "dmcName": "Christmas Red" },
      { "color": "#ffffff" }
    ],
    [
      { "color": "#ff0000", "dmcCode": "DMC 321" },
      { "color": "#0000ff", "dmcCode": "DMC 796" }
    ]
  ],
  "format": "dst",
  "dmcPalette": [
    { "code": "DMC 321", "name": "Christmas Red", "hex": "#e11d48", "count": 2 },
    { "code": "DMC 796", "name": "Royal Blue", "hex": "#1d2c7c", "count": 1 }
  ]
}
```

**Response:** Binary embroidery file with `Content-Type: application/octet-stream`.

## Testing

```bash
pytest
```

## Supported Formats

| Format | Extension | Description |
|--------|-----------|-------------|
| DST    | .dst      | Tajima (industry standard) |
| PES    | .pes      | Brother / Bernina (home machines) |
