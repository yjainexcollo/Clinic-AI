"""Factory for shared Helicone Azure AI client."""

from __future__ import annotations

from typing import Optional

from .ai_client import HeliconeAzureClient
from .config import Settings

_ai_client: Optional[HeliconeAzureClient] = None


def get_ai_client(settings: Settings) -> HeliconeAzureClient:
    """Return singleton HeliconeAzureClient instance."""
    global _ai_client
    if _ai_client is None:
        _ai_client = HeliconeAzureClient(settings)
    return _ai_client


