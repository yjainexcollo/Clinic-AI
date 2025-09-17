"""Lightweight OCR helper with graceful fallback.

Attempts to use pytesseract if available. If not installed or tesseract
binary is missing on the host, returns an empty string without raising.
"""

from __future__ import annotations

from typing import Optional


def extract_text_from_image(image_path: str) -> str:
    """Extract text from an image file, or return empty string on failure."""
    try:
        from PIL import Image  # type: ignore
        import pytesseract  # type: ignore

        img = Image.open(image_path)
        text: str = pytesseract.image_to_string(img) or ""
        # Normalize whitespace
        return " ".join(text.split()).strip()
    except Exception:
        return ""


