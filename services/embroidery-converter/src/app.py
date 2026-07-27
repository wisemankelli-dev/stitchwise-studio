"""
StitchWise Embroidery Converter Service — FastAPI application entry point.

Converts StitchCell[][] grid data into machine embroidery files (.dst, .pes).
Uses pyembroidery for low-level file I/O.

Run with: uvicorn src.app:app --host 0.0.0.0 --port 8001
"""

import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.api.routes import router

# Structured JSON logging to stdout
logging.basicConfig(
    level=logging.INFO,
    format='{"timestamp":"%(asctime)s","level":"%(levelname)s","name":"%(name)s","message":"%(message)s"}',
    datefmt="%Y-%m-%dT%H:%M:%S",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    logger.info("StitchWise Embroidery Converter Service starting...")
    yield
    logger.info("StitchWise Embroidery Converter Service shutting down.")


app = FastAPI(
    title="StitchWise Embroidery Converter Service",
    description=(
        "Microservice for converting StitchCell[][] grid data into machine "
        "embroidery files (.dst, .pes) for Tajima and Brother machines."
    ),
    version="0.1.0",
    lifespan=lifespan,
)

# CORS — allow requests from the main Express backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "*").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routes
app.include_router(router, prefix="/api")


@app.get("/")
async def root():
    """Service root — returns basic info."""
    return {
        "service": "StitchWise Embroidery Converter Service",
        "version": "0.1.0",
        "docs": "/docs",
        "openapi": "/openapi.json",
    }
