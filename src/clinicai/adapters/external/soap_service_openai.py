"""
OpenAI-based SOAP generation service implementation.
"""

import asyncio
import json
from typing import Dict, Any, Optional, List
from openai import OpenAI

from clinicai.application.ports.services.soap_service import SoapService
from clinicai.core.config import get_settings


class OpenAISoapService(SoapService):
    """OpenAI implementation of SoapService."""

    def __init__(self):
        self._settings = get_settings()
        api_key = self._settings.openai.api_key
        if not api_key:
            raise ValueError("OPENAI_API_KEY is not set")
        
        self._client = OpenAI(api_key=api_key)

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
            context_parts.append(f"Chief Complaint: {patient_context.get('disease', 'Not specified')}")
        
        if pre_visit_summary:
            context_parts.append(f"Pre-visit Summary: {pre_visit_summary.get('summary', 'Not available')}")
        
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
            
            return result
            
        except Exception as e:
            raise ValueError(f"SOAP generation failed: {str(e)}")

    def _generate_soap_sync(self, prompt: str) -> Dict[str, Any]:
        """Synchronous SOAP generation method."""
        response = self._client.chat.completions.create(
            model=self._settings.soap.model,
            messages=[
                {
                    "role": "system", 
                    "content": "You are a clinical scribe. Generate accurate, structured SOAP notes from medical consultations. Always respond with valid JSON."
                },
                {"role": "user", "content": prompt}
            ],
            temperature=self._settings.soap.temperature,
            max_tokens=self._settings.soap.max_tokens,
            response_format={"type": "json_object"}
        )
        
        # Parse JSON response
        try:
            soap_data = json.loads(response.choices[0].message.content)
            
            # Validate required fields
            required_fields = ["subjective", "objective", "assessment", "plan"]
            for field in required_fields:
                if field not in soap_data:
                    soap_data[field] = "Not discussed"
            
            # Ensure lists are present
            if "highlights" not in soap_data:
                soap_data["highlights"] = []
            if "red_flags" not in soap_data:
                soap_data["red_flags"] = []
            
            return soap_data
            
        except json.JSONDecodeError as e:
            raise ValueError(f"Failed to parse SOAP JSON response: {str(e)}")

    async def validate_soap_structure(self, soap_data: Dict[str, Any]) -> bool:
        """Validate SOAP note structure and completeness."""
        try:
            # Check required fields
            required_fields = ["subjective", "objective", "assessment", "plan"]
            for field in required_fields:
                if field not in soap_data or not soap_data[field] or soap_data[field].strip() == "":
                    return False
            
            # Check field lengths (not too short, not too long)
            for field in required_fields:
                content = soap_data[field].strip()
                if len(content) < 10:  # Too short
                    return False
                if len(content) > 2000:  # Too long
                    return False
            
            # Check highlights and red_flags are lists
            if not isinstance(soap_data.get("highlights", []), list):
                return False
            if not isinstance(soap_data.get("red_flags", []), list):
                return False
            
            return True
            
        except Exception:
            return False
