"""
Unified Helicone-aware Azure OpenAI client supporting proxy and header-only modes.
"""

from __future__ import annotations

import logging
import os
from typing import Any, Dict, List, Optional

from openai import AsyncAzureOpenAI
from starlette.requests import Request


class HeliconeAzureClient:
    """Azure OpenAI client with Helicone proxy/header support and metadata injection."""

    def __init__(self, settings) -> None:
        self._settings = settings
        self._logger = logging.getLogger(__name__)
        self._helicone_api_key = settings.helicone.api_key or os.getenv("HELICONE_API_KEY") or ""
        
        # Normalize HELICONE_BASE_URL: preserve /v1 path, strip trailing slash only if needed
        raw_base_url = settings.helicone.base_url or os.getenv("HELICONE_BASE_URL") or ""
        if raw_base_url:
            # If URL ends with "/v1/" → strip only trailing slash to get "/v1"
            if raw_base_url.endswith("/v1/"):
                self._helicone_base_url = raw_base_url.rstrip("/")
            # If URL ends with "/v1" → keep it unchanged
            elif raw_base_url.endswith("/v1"):
                self._helicone_base_url = raw_base_url
            # If URL ends with "/" but NOT "/v1/" → strip the slash
            elif raw_base_url.endswith("/"):
                self._helicone_base_url = raw_base_url.rstrip("/")
            else:
                self._helicone_base_url = raw_base_url
        else:
            self._helicone_base_url = ""
        
        self._mode = "proxy" if self._helicone_base_url else "header"

        client_kwargs: Dict[str, Any] = {
            "api_key": settings.azure_openai.api_key,
            "api_version": settings.azure_openai.api_version,
        }

        if self._mode == "proxy":
            client_kwargs["base_url"] = self._helicone_base_url
            self._logger.info(
                "HeliconeAzureClient initialized in PROXY mode (base_url=%s)", self._helicone_base_url
            )
        else:
            client_kwargs["azure_endpoint"] = settings.azure_openai.endpoint.rstrip("/")
            self._logger.info(
                "HeliconeAzureClient initialized in HEADER mode (endpoint=%s)", settings.azure_openai.endpoint
            )

        self._client = AsyncAzureOpenAI(**client_kwargs)

    async def chat(
        self,
        *,
        messages: List[Dict[str, str]],
        model: Optional[str],
        request: Optional[Request] = None,
        route_name: str = "chat_completion",
        temperature: float = 0.7,
        max_tokens: Optional[int] = None,
        custom_properties: Optional[Dict[str, Any]] = None,
        background_metadata: Optional[Dict[str, Any]] = None,
        **kwargs: Any,
    ):
        """Chat completion helper with Helicone metadata.
        
        Args:
            request: FastAPI Request object (for HTTP requests)
            background_metadata: Dict with patient_id, visit_id, request_id for background jobs
        """
        deployment = model or self._settings.azure_openai.deployment_name
        extra_headers = self._inject_metadata(
            request=request,
            route_name=route_name,
            model=deployment,
            custom_properties=custom_properties,
            background_metadata=background_metadata,
        )
        return await self._client.chat.completions.create(
            model=deployment,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
            extra_headers=extra_headers or None,
            **kwargs,
        )

    async def summarize(
        self,
        *,
        messages: List[Dict[str, str]],
        model: Optional[str],
        request: Optional[Request] = None,
        route_name: str = "summarize",
        background_metadata: Optional[Dict[str, Any]] = None,
        **kwargs: Any,
    ):
        """Convenience wrapper for summary-style prompts."""
        return await self.chat(
            messages=messages,
            model=model,
            request=request,
            route_name=route_name,
            background_metadata=background_metadata,
            **kwargs,
        )

    async def embed(
        self,
        *,
        inputs: List[str],
        model: Optional[str],
        request: Optional[Request] = None,
        route_name: str = "embedding",
        custom_properties: Optional[Dict[str, Any]] = None,
        background_metadata: Optional[Dict[str, Any]] = None,
        **kwargs: Any,
    ):
        """Create embeddings with Helicone metadata."""
        deployment = model or self._settings.azure_openai.deployment_name
        extra_headers = self._inject_metadata(
            request=request,
            route_name=route_name,
            model=deployment,
            custom_properties=custom_properties,
            background_metadata=background_metadata,
        )
        return await self._client.embeddings.create(
            model=deployment,
            input=inputs,
            extra_headers=extra_headers or None,
            **kwargs,
        )

    async def transcribe_whisper(
        self,
        *,
        file,
        language: Optional[str],
        request: Optional[Request] = None,
        route_name: str = "whisper_transcription",
        model: Optional[str] = None,
        custom_properties: Optional[Dict[str, Any]] = None,
        background_metadata: Optional[Dict[str, Any]] = None,
        **kwargs: Any,
    ):
        """Azure Whisper transcription with Helicone metadata."""
        deployment = model or self._settings.azure_openai.whisper_deployment_name
        extra_headers = self._inject_metadata(
            request=request,
            route_name=route_name,
            model=deployment,
            custom_properties=custom_properties,
            background_metadata=background_metadata,
        )
        return await self._client.audio.transcriptions.create(
            model=deployment,
            file=file,
            language=language,
            extra_headers=extra_headers or None,
            **kwargs,
        )

    def _inject_metadata(
        self,
        *,
        request: Optional[Request],
        route_name: str,
        model: str,
        custom_properties: Optional[Dict[str, Any]],
        background_metadata: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, str]:
        """Inject Helicone metadata from request or background_metadata.
        
        Args:
            request: FastAPI Request object (takes priority)
            background_metadata: Dict with patient_id, visit_id, request_id for background jobs
        """
        headers: Dict[str, str] = {}

        if self._helicone_api_key:
            headers["Helicone-Auth"] = f"Bearer {self._helicone_api_key}"

        headers["Helicone-Property-App"] = "clinic-ai"
        headers["Helicone-Property-Environment"] = self._settings.app_env
        headers["Helicone-Property-Model"] = model
        headers["Helicone-Property-Route"] = route_name
        headers["Helicone-Cache-Enabled"] = "false"

        # Extract metadata from request (priority) or background_metadata
        request_id = None
        patient_id = None
        visit_id = None

        if request:
            request_id = getattr(request.state, "request_id", None)
            patient_id = getattr(request.state, "audit_patient_id", None)
            visit_id = getattr(request.state, "audit_visit_id", None)
        elif background_metadata:
            request_id = background_metadata.get("request_id")
            patient_id = background_metadata.get("patient_id")
            visit_id = background_metadata.get("visit_id")

        if request_id:
            headers["Helicone-Property-Request-Id"] = str(request_id)

        if patient_id:
            headers["Helicone-Property-Patient-Id"] = str(patient_id)

        if visit_id:
            headers["Helicone-Property-Visit-Id"] = str(visit_id)

        if custom_properties:
            for key, value in custom_properties.items():
                if value is not None:
                    headers[f"Helicone-Property-{key}"] = str(value)

        return headers

    def build_headers_for_background(
        self,
        *,
        patient_id: Optional[str] = None,
        visit_id: Optional[str] = None,
        request_id: Optional[str] = None,
        route_name: Optional[str] = None,
        model: Optional[str] = None,
        custom_properties: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, str]:
        """Generate Helicone headers for background jobs without FastAPI request.
        
        Allows background tasks to send Helicone metadata without FastAPI Request.
        
        Args:
            patient_id: Patient identifier
            visit_id: Visit identifier
            request_id: Request identifier (will be generated if not provided)
            route_name: Route name for the operation
            model: Model/deployment name
            custom_properties: Additional custom properties
        """
        return self._inject_metadata(
            request=None,
            route_name=route_name or "background_task",
            model=model or self._settings.azure_openai.deployment_name,
            custom_properties=custom_properties,
            background_metadata={
                "patient_id": patient_id,
                "visit_id": visit_id,
                "request_id": request_id,
            },
        )


