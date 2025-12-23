"""
Shared helper to structure raw transcript into Doctor/Patient dialogue.

This mirrors the logic used in the visit transcript route so both visit and
ad-hoc flows produce consistent outputs.
"""

from typing import List, Dict, Optional
import asyncio
import re as _re

from clinicai.core.ai_factory import get_ai_client
from clinicai.core.config import get_settings


async def structure_dialogue_from_text(
    raw: str, 
    *, 
    model: str, 
    azure_endpoint: Optional[str] = None,
    azure_api_key: Optional[str] = None,
    api_key: Optional[str] = None,  # Deprecated - use azure_api_key
    language: str = "en"
) -> Optional[List[Dict[str, str]]]:
    """
    Structure dialogue from text using Azure OpenAI.
    
    Args:
        raw: Raw transcript text
        model: Azure OpenAI deployment name (required)
        azure_endpoint: Azure OpenAI endpoint (required if not in settings)
        azure_api_key: Azure OpenAI API key (required if not in settings)
        api_key: Deprecated - ignored, use azure_api_key instead
        language: Language code (en/sp)
    
    Returns:
        List of dialogue turns or None if processing failed
    
    Raises:
        ValueError: If Azure OpenAI is not configured
    """
    if not raw:
        return None
    try:
        settings = get_settings()

        deployment_name = model or settings.azure_openai.deployment_name

        # Always use factory client (configured via settings/env)
        # Custom credentials should be configured via environment variables or settings
        # rather than passed as parameters to maintain consistency
        client = get_ai_client()

                # Unified system prompt (English) for all languages
        transcript_language = (language or "en").lower()
        system_prompt = """You are an expert medical dialogue analyzer. Convert raw medical consultation transcripts (English or Spanish) into structured Doctor-Patient dialogue while preserving verbatim accuracy. Keep the original language; do not translate or paraphrase. Remove only standalone personal identifiers (names, phone numbers, street addresses, specific calendar dates, SSN, explicit ages) while preserving medical terminology and medication names. Remove non-dialogue sounds or environmental narration; keep spoken words only. Identify speakers by context: questions/instructions/clinical assessments -> Doctor; first-person symptoms/short answers -> Patient; third-person about the patient -> Family Member. Ignore incorrect input labels and relabel based on content. Output only a valid JSON array of turns like {"Doctor": "..."}, {"Patient": "..."} or {"Family Member": "..."} with all dialogue preserved in order, no markdown or comments."""

        import json as _json
        sentences = [_s.strip() for _s in _re.split(r"(?<=[.!?])\s+", raw) if _s.strip()]
        # More specific model detection for chunk sizing
        deployment_name_lower = str(deployment_name).lower()
        if 'gpt-4o-mini' in deployment_name_lower:
            max_chars_per_chunk = 6000  # Conservative for mini model
        elif deployment_name_lower.startswith('gpt-4'):
            max_chars_per_chunk = 8000  # Full GPT-4 models
        else:
            max_chars_per_chunk = 5000  # Other models
        overlap_chars = 500

        if len(raw) <= max_chars_per_chunk:
            if (language or "en").lower() in ["sp", "es", "es-es", "es-mx", "spanish"]:
                user_prompt = (
                    "TRANSCRIPCIÓN DE CONSULTA MÉDICA:\n"
                    f"{raw}\n\n"
                    "TAREA: Convierte esta transcripción en diálogo estructurado Doctor-Paciente.\n"
                    "• Preserva TODO el texto literalmente - no modifiques, parafrasees o corrijas\n"
                    "• Usa análisis basado en contexto: analiza el turno previo para determinar el hablante\n"
                    "• Elimina SOLO identificadores personales independientes (nombres, números de teléfono, direcciones, fechas específicas, SSN)\n"
                    "• Devuelve un objeto JSON con clave 'dialogue' conteniendo el arreglo, o devuelve el arreglo directamente\n\n"
                    "SALIDA: Arreglo JSON válido que empiece con [ y termine con ]"
                )
            else:
                user_prompt = (
                    "MEDICAL CONSULTATION TRANSCRIPT:\n"
                    f"{raw}\n\n"
                    "TASK: Convert this transcript into structured Doctor-Patient dialogue.\n"
                    "• Preserve ALL text verbatim - do not modify, paraphrase, or correct\n"
                    "• Use context-based analysis: analyze previous turn to determine speaker\n"
                    "• Remove ONLY standalone personal identifiers (names, phone numbers, addresses, specific dates, SSN)\n"
                    "• Return a JSON object with key 'dialogue' containing the array, or return the array directly\n\n"
                    "OUTPUT: Valid JSON array starting with [ and ending with ]"
                )

            async def _call_openai() -> str:
                try:
                    resp = await client.chat(
                        model=deployment_name,
                        messages=[
                            {"role": "system", "content": system_prompt},
                            {"role": "user", "content": user_prompt},
                        ],
                        max_tokens=4000 if is_gpt4 else 2000,
                        temperature=0.0,
                        response_format={"type": "json_object"},  # enforce strict JSON when supported
                    )
                except Exception:
                    # Fallback without response_format if unsupported
                    resp = await client.chat(
                        model=deployment_name,
                        messages=[
                            {"role": "system", "content": system_prompt},
                            {"role": "user", "content": user_prompt},
                        ],
                        max_tokens=4000 if is_gpt4 else 2000,
                        temperature=0.0,
                    )
                return (resp.choices[0].message.content or "").strip()

            content = await _call_openai()
        else:
            chunks: List[str] = []
            current_chunk = ""
            for s in sentences:
                if len(current_chunk) + len(s) + 1 > max_chars_per_chunk and current_chunk:
                    chunks.append(current_chunk.strip())
                    overlap_start = max(0, len(current_chunk) - overlap_chars)
                    current_chunk = current_chunk[overlap_start:] + " " + s
                else:
                    current_chunk += (" " + s) if current_chunk else s
            if current_chunk:
                chunks.append(current_chunk.strip())

            async def _call_openai_chunk(text: str) -> str:
                if (language or "en").lower() in ["sp", "es", "es-es", "es-mx", "spanish"]:
                    user_prompt = (
                        "FRAGMENTO DE TRANSCRIPCIÓN (Parte de conversación más larga):\n"
                        f"{text}\n\n"
                        "TAREA: Convierte este fragmento en diálogo estructurado Doctor-Paciente.\n"
                        "• Preserva TODO el texto literalmente - no modifiques, parafrasees o corrijas\n"
                        "• Usa análisis basado en contexto: analiza el turno previo para determinar el hablante\n"
                        "• Esto es parte de una conversación más larga - mantén continuidad\n"
                        "• Elimina SOLO identificadores personales independientes (nombres, números de teléfono, direcciones, fechas específicas, SSN)\n"
                        "• Devuelve un objeto JSON con clave 'dialogue' conteniendo el arreglo, o devuelve el arreglo directamente\n\n"
                        "SALIDA: Arreglo JSON válido que empiece con [ y termine con ]"
                    )
                else:
                    user_prompt = (
                        "TRANSCRIPT CHUNK (Part of larger conversation):\n"
                        f"{text}\n\n"
                        "TASK: Convert this chunk into structured Doctor-Patient dialogue.\n"
                        "• Preserve ALL text verbatim - do not modify, paraphrase, or correct\n"
                        "• Use context-based analysis: analyze previous turn to determine speaker\n"
                        "• This is part of a larger conversation - maintain continuity\n"
                        "• Remove ONLY standalone personal identifiers (names, phone numbers, addresses, specific dates, SSN)\n"
                        "• Return a JSON object with key 'dialogue' containing the array, or return the array directly\n\n"
                        "OUTPUT: Valid JSON array starting with [ and ending with ]"
                    )
                try:
                    resp = await client.chat(
                        model=deployment_name,
                        messages=[
                            {"role": "system", "content": system_prompt},
                            {"role": "user", "content": user_prompt},
                        ],
                        max_tokens=4000 if is_gpt4 else 2000,
                        temperature=0.0,
                        response_format={"type": "json_object"},
                    )
                except Exception:
                    resp = await client.chat(
                        model=deployment_name,
                        messages=[
                            {"role": "system", "content": system_prompt},
                            {"role": "user", "content": user_prompt},
                        ],
                        max_tokens=4000 if is_gpt4 else 2000,
                        temperature=0.0,
                    )
                return (resp.choices[0].message.content or "").strip()

            def _extract_json_array(text: str) -> Optional[List[Dict[str, str]]]:
                try:
                    # Prefer JSON object with 'dialogue'
                    parsed = _json.loads(text)
                    if isinstance(parsed, dict) and isinstance(parsed.get("dialogue"), list):
                        return parsed["dialogue"]  # type: ignore
                    if isinstance(parsed, list):
                        return parsed  # type: ignore
                except Exception:
                    pass
                # Try to extract the first top-level JSON array substring
                try:
                    m = _re.search(r"\[\s*\{[\s\S]*\}\s*\]", text)
                    if m:
                        arr = _json.loads(m.group(0))
                        if isinstance(arr, list):
                            return arr  # type: ignore
                    # Try to extract object with dialogue key
                    m2 = _re.search(r"\{[\s\S]*?\"dialogue\"\s*:\s*\[[\s\S]*?\][\s\S]*?\}", text)
                    if m2:
                        obj = _json.loads(m2.group(0))
                        if isinstance(obj, dict) and isinstance(obj.get("dialogue"), list):
                            return obj["dialogue"]  # type: ignore
                except Exception:
                    pass
                return None

            parts: List[Dict[str, str]] = []
            for ch in chunks:
                chunk_result = await _call_openai_chunk(ch)
                parsed = _extract_json_array(chunk_result)
                if isinstance(parsed, list):
                    parts.extend(parsed)

            # Merge trivial consecutive duplicates
            merged: List[Dict[str, str]] = []
            for item in parts:
                if not merged:
                    merged.append(item)
                    continue
                try:
                    if (
                        len(item) == 1
                        and len(merged[-1]) == 1
                        and list(item.keys())[0] == list(merged[-1].keys())[0]
                        and list(item.values())[0] == list(merged[-1].values())[0]
                    ):
                        continue
                except Exception:
                    pass
                merged.append(item)
            import json as _json2
            if not merged:
                # Heuristic fallback if model returned nothing useful
                turns: List[Dict[str, str]] = []
                patient_label = "Paciente" if (language or "en").lower() in ["sp", "es", "es-es", "es-mx", "spanish"] else "Patient"
                next_role = "Doctor"
                for s in sentences:
                    low = s.lower()
                    if low.startswith("doctor:") or low.startswith("doctora:"):
                        turns.append({"Doctor": s.split(":", 1)[1].strip()})
                        next_role = patient_label
                    elif low.startswith("patient:") or low.startswith("paciente:"):
                        turns.append({patient_label: s.split(":", 1)[1].strip()})
                        next_role = "Doctor"
                    else:
                        turns.append({next_role: s})
                        next_role = patient_label if next_role == "Doctor" else "Doctor"
                return turns
            content = _json2.dumps(merged)

        import json
        try:
            parsed = json.loads(content)
            if isinstance(parsed, dict) and isinstance(parsed.get("dialogue"), list):
                return parsed["dialogue"]
            if isinstance(parsed, list):
                return parsed
        except Exception:
            # Heuristic fallback: alternate speakers
            turns: List[Dict[str, str]] = []
            patient_label = "Paciente" if (language or "en").lower() in ["sp", "es", "es-es", "es-mx", "spanish"] else "Patient"
            next_role = "Doctor"
            for s in sentences:
                low = s.lower()
                if low.startswith("doctor:") or low.startswith("doctora:"):
                    turns.append({"Doctor": s.split(":", 1)[1].strip()})
                    next_role = patient_label
                elif low.startswith("patient:") or low.startswith("paciente:"):
                    turns.append({patient_label: s.split(":", 1)[1].strip()})
                    next_role = "Doctor"
                else:
                    turns.append({next_role: s})
                    next_role = patient_label if next_role == "Doctor" else "Doctor"
            return turns
    except Exception:
        return None



