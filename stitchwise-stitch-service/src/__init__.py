"""
StitchWise Stitch Service — Python microservice for embroidery file generation.

Wraps pyembroidery to convert SVG/JSON design data into machine embroidery
files (.dst, .pes, .exp). Called by the Node.js backend via HTTP.
"""
__version__ = "0.1.0"