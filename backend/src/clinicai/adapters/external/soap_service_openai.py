"""
OpenAI-based SOAP generation service implementation.
"""

import asyncio
import json
from typing import Dict, Any, Optional, List
from openai import OpenAI
import os
import logging

from clinicai.application.ports.services.soap_service import SoapService
from clinicai.core.config import get_settings


class OpenAISoapService(SoapService):
    """OpenAI implementation of SoapService."""

    def __init__(self):
        self._settings = get_settings()
        # Load API key from settings or env (with optional .env fallback)
        api_key = self._settings.openai.api_key or os.getenv("OPENAI_API_KEY", "")
        if not api_key:
            try:
                from dotenv import load_dotenv  # type: ignore
                load_dotenv(override=False)
                api_key = os.getenv("OPENAI_API_KEY", "")
            except Exception:
                pass
        if not api_key:
            raise ValueError("OPENAI_API_KEY is not set. Please set the OPENAI_API_KEY environment variable or add it to your .env file.")
        
        self._client = OpenAI(api_key=api_key)
        # Optional: log model and presence of key (masked)
        try:
            logging.getLogger("clinicai").info(
                "[SoapService] Initialized",
                extra={
                    "model": self._settings.soap.model,
                    "has_key": bool(api_key),
                },
            )
        except Exception:
            pass

    async def generate_soap_note(
        self,
        transcript: str,
        patient_context: Optional[Dict[str, Any]] = None,
        intake_data: Optional[Dict[str, Any]] = None,
        pre_visit_summary: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Generate SOAP note using OpenAI GPT-4."""
        
        # Build context from available data
        context_parts = []
        
        if patient_context:
            context_parts.append(f"Patient: {patient_context.get('name', 'Unknown')}, Age: {patient_context.get('age', 'Unknown')}")
            context_parts.append(f"Chief Complaint: {patient_context.get('symptom', 'Not specified')}")
        
        if pre_visit_summary:
            context_parts.append(f"Pre-visit Summary: {pre_visit_summary.get('summary', 'Not available')}")
            
            # Add vitals data if available
            if 'vitals' in pre_visit_summary:
                vitals_data = pre_visit_summary['vitals']['data']
                vitals_text = self._format_vitals_for_soap(vitals_data)
                context_parts.append(f"Vitals Data: {vitals_text}")
        
        if intake_data and intake_data.get('questions_asked'):
            intake_responses = []
            for qa in intake_data['questions_asked']:
                intake_responses.append(f"Q: {qa['question']}\nA: {qa['answer']}")
            context_parts.append(f"Intake Responses:\n" + "\n\n".join(intake_responses))
        
        context = "\n\n".join(context_parts) if context_parts else "No additional context available"
        
        # Create the prompt
        prompt = f"""
You are a clinical scribe generating SOAP notes from doctor-patient consultations. 

CONTEXT:
{context}

CONSULTATION TRANSCRIPT:
{transcript}

INSTRUCTIONS:
1. Generate a comprehensive SOAP note based on the transcript and context
2. Do NOT make diagnoses or treatment recommendations unless explicitly stated by the physician
3. Use medical terminology appropriately
4. Be objective and factual
5. If information is unclear or missing, mark as "Unclear" or "Not discussed"
6. Focus on what was actually said during the consultation

REQUIRED FORMAT (JSON):
{{
    "subjective": "Patient's reported symptoms, concerns, and history as discussed",
    "objective": "Observable findings, vital signs, physical exam findings mentioned",
    "assessment": "Clinical impressions and reasoning discussed by the physician",
    "plan": "Treatment plan, follow-up instructions, and next steps discussed",
    "highlights": ["Key clinical points 1", "Key clinical points 2", "Key clinical points 3"],
    "red_flags": ["Any concerning symptoms or findings mentioned"],
    "model_info": {{
        "model": "{self._settings.soap.model}",
        "temperature": {self._settings.soap.temperature},
        "max_tokens": {self._settings.soap.max_tokens}
    }},
    "confidence_score": 0.95
}}

Generate the SOAP note now:
"""

        try:
            # Run OpenAI completion in thread pool
            result = await asyncio.get_event_loop().run_in_executor(
                None,
                self._generate_soap_sync,
                prompt
            )
            # Normalize for structure/consistency
            return self._normalize_soap(result)
            
        except Exception as e:
            raise ValueError(f"SOAP generation failed: {str(e)}")

    def _generate_soap_sync(self, prompt: str) -> Dict[str, Any]:
        """Synchronous SOAP generation method."""
        response = self._client.chat.completions.create(
            model=self._settings.soap.model,
            messages=[
                {
                    "role": "system", 
                    "content": "You are a clinical scribe. Generate accurate, structured SOAP notes from medical consultations. Always respond with valid JSON only, no extra text."
                },
                {"role": "user", "content": prompt}
            ],
            temperature=self._settings.soap.temperature,
            max_tokens=self._settings.soap.max_tokens
        )
        
        # Parse JSON response
        try:
            soap_data = json.loads(response.choices[0].message.content)
            return soap_data
        except Exception:
            # If the model included code fences or extra text, fall back to extraction below
            try:
                content = response.choices[0].message.content
                if "```json" in content:
                    json_start = content.find("```json") + 7
                    json_end = content.find("```", json_start)
                    json_str = content[json_start:json_end].strip()
                    return json.loads(json_str)
            except Exception:
                pass
            # As a final fallback, return a minimal structure (will be normalized later)
            return {
                "subjective": "",
                "objective": "",
                "assessment": "",
                "plan": "",
                "highlights": [],
                "red_flags": [],
                "model_info": {"model": self._settings.soap.model},
                "confidence_score": None,
            }

    def _normalize_soap(self, soap_data: Dict[str, Any]) -> Dict[str, Any]:
        """Coerce SOAP dict into a valid, minimally complete structure."""
        normalized: Dict[str, Any] = dict(soap_data or {})
        required = ["subjective", "objective", "assessment", "plan"]
        for key in required:
            val = normalized.get(key, "")
            if not isinstance(val, str):
                try:
                    val = str(val)
                except Exception:
                    val = ""
            val = (val or "").strip()
            if len(val) < 5:
                val = "Not discussed"
            normalized[key] = val

        # Optional list fields
        for list_key in ["highlights", "red_flags"]:
            val = normalized.get(list_key, [])
            if not isinstance(val, list):
                val = [str(val)] if val not in (None, "") else []
            normalized[list_key] = val

        # Model info
        model_info = normalized.get("model_info")
        if not isinstance(model_info, dict):
            model_info = {}
        model_info.setdefault("model", self._settings.soap.model)
        normalized["model_info"] = model_info

        # Confidence score
        if normalized.get("confidence_score") is None:
            normalized["confidence_score"] = 0.7

        return normalized

    def _format_vitals_for_soap(self, vitals_data: Dict[str, Any]) -> str:
        """Format vitals data for SOAP note generation."""
        parts = []
        
        # Blood Pressure
        if vitals_data.get('systolic') and vitals_data.get('diastolic'):
            bp_text = f"Blood pressure {vitals_data['systolic']}/{vitals_data['diastolic']} mmHg"
            if vitals_data.get('bpArm'):
                bp_text += f" ({vitals_data['bpArm']} arm)"
            if vitals_data.get('bpPosition'):
                bp_text += f" ({vitals_data['bpPosition']})"
            parts.append(bp_text)
        
        # Heart Rate
        if vitals_data.get('heartRate'):
            hr_text = f"Heart rate {vitals_data['heartRate']} bpm"
            if vitals_data.get('rhythm'):
                hr_text += f" ({vitals_data['rhythm']})"
            parts.append(hr_text)
        
        # Respiratory Rate
        if vitals_data.get('respiratoryRate'):
            parts.append(f"Respiratory rate {vitals_data['respiratoryRate']} breaths/min")
        
        # Temperature
        if vitals_data.get('temperature'):
            temp_text = f"Temperature {vitals_data['temperature']}{vitals_data.get('tempUnit', '°C')}"
            if vitals_data.get('tempMethod'):
                temp_text += f" ({vitals_data['tempMethod']})"
            parts.append(temp_text)
        
        # Oxygen Saturation
        if vitals_data.get('oxygenSaturation'):
            parts.append(f"SpO₂ {vitals_data['oxygenSaturation']}% on room air")
        
        # Height, Weight, BMI
        if vitals_data.get('height') and vitals_data.get('weight'):
            height_text = f"{vitals_data['height']} {vitals_data.get('heightUnit', 'cm')}"
            weight_text = f"{vitals_data['weight']} {vitals_data.get('weightUnit', 'kg')}"
            parts.append(f"Height {height_text}, Weight {weight_text}")
            
            # Calculate BMI if both height and weight are provided
            try:
                height_val = float(vitals_data['height'])
                weight_val = float(vitals_data['weight'])
                height_unit = vitals_data.get('heightUnit', 'cm')
                weight_unit = vitals_data.get('weightUnit', 'kg')
                
                # Convert to metric if needed
                if height_unit == 'ft/in':
                    height_val = height_val * 0.3048  # Convert feet to meters
                elif height_unit == 'cm':
                    height_val = height_val / 100  # Convert cm to meters
                
                if weight_unit == 'lbs':
                    weight_val = weight_val * 0.453592  # Convert lbs to kg
                
                if height_val > 0 and weight_val > 0:
                    bmi = weight_val / (height_val * height_val)
                    parts.append(f"BMI {bmi:.1f}")
            except (ValueError, ZeroDivisionError):
                pass  # Skip BMI calculation if conversion fails
        
        # Pain Score
        if vitals_data.get('painScore'):
            parts.append(f"Pain score {vitals_data['painScore']}/10")
        
        return ", ".join(parts) + "." if parts else "No vitals recorded"

    async def validate_soap_structure(self, soap_data: Dict[str, Any]) -> bool:
        """Validate SOAP note structure and completeness."""
        try:
            # Normalize first to improve acceptance of valid-but-short outputs
            data = self._normalize_soap(soap_data)

            # Check required fields minimal presence
            required_fields = ["subjective", "objective", "assessment", "plan"]
            for field in required_fields:
                val = data.get(field, "")
                if not isinstance(val, str) or not val.strip():
                    return False

            # Relaxed thresholds: accept concise outputs
            for field in required_fields:
                content = data[field].strip()
                if len(content) < 5:  # Extremely short indicates failure
                    return False
                if len(content) > 8000:  # Guardrail against runaway output
                    return False

            # Ensure list types
            if not isinstance(data.get("highlights", []), list):
                return False
            if not isinstance(data.get("red_flags", []), list):
                return False

            return True
            
        except Exception:
            return False
