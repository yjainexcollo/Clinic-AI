"""OpenAI implementation of QuestionService for AI-powered question generation."""
import asyncio
import os
import base64
import mimetypes
from pathlib import Path
from typing import Any, Dict, List

from openai import OpenAI

from clinicai.application.ports.services.question_service import QuestionService
from clinicai.core.config import get_settings


class OpenAIQuestionService(QuestionService):
    """OpenAI implementation of QuestionService."""

    def __init__(self):
        try:
            from dotenv import load_dotenv  # type: ignore
        except Exception:
            load_dotenv = None

        self._settings = get_settings()
        api_key = self._settings.openai.api_key or os.getenv("OPENAI_API_KEY", "")

        # Fallback: look for .env manually (for environments where pydantic doesn't pick it up)
        if not api_key and load_dotenv is not None:
            cwd = Path(os.getcwd()).resolve()
            for parent in [cwd, *cwd.parents]:
                candidate = parent / ".env"
                if candidate.exists():
                    load_dotenv(dotenv_path=str(candidate), override=False)
                    api_key = os.getenv("OPENAI_API_KEY", "")
                    if api_key:
                        break

        if not api_key:
            raise ValueError("OPENAI_API_KEY is not set")

        self._client = OpenAI(api_key=api_key)

    async def _chat_completion(
        self, messages: List[Dict[str, str]], max_tokens: int, temperature: float
    ) -> str:
        """Run sync OpenAI chat.completions in a thread to keep async API."""

        def _run():
            resp = self._client.chat.completions.create(
                model=self._settings.openai.model,
                messages=messages,
                max_tokens=max_tokens,
                temperature=temperature,
            )
            return resp.choices[0].message.content.strip()

        return await asyncio.to_thread(_run)

    # ----------------------
    # Question generation
    # ----------------------
    async def generate_first_question(self, disease: str) -> str:
        """First question is fixed to collect symptom; ignore param."""
        return "What is your primary symptom or chief complaint today?"

    async def generate_next_question(
        self,
        disease: str,
        previous_answers: List[str],
        asked_questions: List[str],
        current_count: int,
        max_count: int,
    ) -> str:
        """Generate the next question with mandatory coverage."""
        prompt = (
            f"Primary symptom: {disease}.\n"
            f"Previous answers (last 3): {', '.join(previous_answers[-3:])}.\n"
            f"Already asked: {asked_questions}.\n"
            f"Current question count: {current_count}/{max_count}.\n\n"
            "You are a medical intake assistant.\n\n"
            "INSTRUCTIONS:\n"
            "- Ask ONE clear, symptom-focused, professional question.\n"
            "- Do NOT repeat questions already asked.\n"
            "- Do NOT ask again about topics already present in the patient's answers.\n"
            "- Mandatory coverage (prioritize if not covered yet):\n"
            "  1) Allergies\n"
            "  2) Current medicines/treatments for this problem\n"
            "  3) Past history of the same problem\n"
            "  4) Family history (only if symptom suggests hereditary/serious concern: asthma, chest pain, diabetes, hypertension, cancer)\n"
            "  5) Other essential intake details for a general physician\n"
            "- Focus areas: duration, severity, triggers, associated symptoms, impact on daily life, relevant past history.\n"
            "- If asking about current medicines/treatments, append this EXACT hint at the end to cue the client UI to show camera/file picker: [You can upload a clear photo of the medication/ prescription label.]\n"
            "Return ONLY the question text (include the bracketed hint ONLY for the meds/treatments question)."
        )
        try:
            text = await self._chat_completion(
                messages=[
                    {
                        "role": "system",
                        "content": "You are a clinical intake assistant. Never repeat prior questions.",
                    },
                    {"role": "user", "content": prompt},
                ],
                max_tokens=min(256, self._settings.openai.max_tokens),
                temperature=float(self._settings.openai.temperature),
            )
            text = text.replace("\n", " ").strip()
            if not text.endswith("?"):
                text = text.rstrip(".") + "?"
            if any(text.lower() == q.lower() for q in asked_questions):
                return self._get_fallback_next_question(disease, current_count)
            return text
        except Exception:
            return self._get_fallback_next_question(disease, current_count)

    async def should_stop_asking(
        self,
        disease: str,
        previous_answers: List[str],
        current_count: int,
        max_count: int,
    ) -> bool:
        """Determine if sufficient information has been collected."""
        if current_count >= max_count:
            return True
        if current_count < 3:
            return False

        prompt = (
            "You evaluate if intake has sufficient information.\n"
            f"Primary symptom: {disease}. Questions asked: {current_count}/{max_count}.\n"
            f"Patient answers: {', '.join(previous_answers)}.\n"
            "Reply with only YES (sufficient) or NO (need more)."
        )
        try:
            reply = await self._chat_completion(
                messages=[
                    {"role": "system", "content": "You decide if intake is sufficient."},
                    {"role": "user", "content": prompt},
                ],
                max_tokens=8,
                temperature=0.0,
            )
            return reply.strip().upper().startswith("YES")
        except Exception:
            return current_count >= 5 or current_count >= max_count

    # ----------------------
    # Fallbacks
    # ----------------------
    def _get_fallback_first_question(self, disease: str) -> str:
        fallback_questions = {
            "Hypertension": "What symptoms are you experiencing related to your blood pressure?",
            "Diabetes": "What symptoms are you experiencing related to your diabetes?",
            "Chest Pain": "Can you describe the chest pain you're experiencing?",
            "Fever": "What is your current temperature and how long have you had fever?",
            "Cough": "Can you describe the type of cough you're experiencing?",
            "Headache": "Can you describe the headache you're experiencing?",
            "Back Pain": "Can you describe the back pain you're experiencing?",
        }
        return fallback_questions.get(
            disease, f"What symptoms are you experiencing with your {disease.lower()}?"
        )

    def _get_fallback_next_question(self, disease: str, current_count: int) -> str:
        fallback_questions = [
            "How long have you been experiencing these symptoms?",
            "On a scale of 1-10, how would you rate the severity?",
            "Are there any activities that make the symptoms worse?",
            "Have you tried any treatments or medications?",
            "How is this affecting your daily activities?",
            "Do you have any other medical conditions I should be aware of?",
            "Are you allergic to any medications or other substances?",
            "Are you experiencing any other associated symptoms?",
            "Have you had similar symptoms before?",
            "Does anyone in your immediate family have a history of similar health issues?",
            "Is there anything that seems to trigger these symptoms?",
            "Are the symptoms constant or do they come and go?",
            "Have you noticed any patterns with these symptoms?",
        ]
        if current_count < len(fallback_questions):
            return fallback_questions[current_count]
        return "Is there anything else you'd like to tell us about your condition?"

    # ----------------------
    # Pre-visit summary
    # ----------------------
    async def generate_pre_visit_summary(
        self, patient_data: Dict[str, Any], intake_answers: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Generate pre-visit clinical summary from intake data."""
        prompt = f"""
Generate a clinical pre-visit summary for the following patient data:

Patient Information:
- Name: {patient_data.get('name', 'N/A')}
- Age: {patient_data.get('age', 'N/A')}
- Mobile: {patient_data.get('mobile', 'N/A')}
- Primary Symptom: {patient_data.get('symptom', 'N/A')}

Intake Responses:
{self._format_intake_answers(intake_answers)}

Generate a SOAP-compatible clinical summary with the following structure:

## PRE-VISIT SUMMARY

### Chief Complaint
[Primary reason for visit]

### History of Present Illness
[Description of symptoms, duration, severity, factors]

### Review of Systems
[Systematic review based on answers]

### Past Medical History
[Chronic conditions, prior illnesses]

### Medications
[Current treatments]

### Allergies
[Reported allergies]

### Social History
[Relevant social factors]

### Assessment & Plan
[Preliminary assessment and recommended steps]

### Key Clinical Points
- [3-5 most important findings]
- [Any red flags]
- [Areas for focused exam]

Return JSON with keys: "summary" (markdown text) and "structured_data" (key-value pairs).
""".strip()

        try:
            # Collect attached images (e.g., medication photos)
            image_paths: List[str] = []
            if isinstance(intake_answers, dict):
                for qa in intake_answers.get("questions_asked", []) or []:
                    img = qa.get("attachment_image_path")
                    if img:
                        image_paths.append(img)

            if image_paths:
                # Vision-style message: text + image_url parts (data URLs)
                def _encode_image_to_data_url(image_path: str) -> str:
                    try:
                        mime_type, _ = mimetypes.guess_type(image_path)
                        if not mime_type:
                            mime_type = "image/jpeg"
                        with open(image_path, "rb") as f:
                            b64 = base64.b64encode(f.read()).decode("utf-8")
                        return f"data:{mime_type};base64,{b64}"
                    except Exception:
                        return ""

                content_parts: List[Dict[str, Any]] = [{"type": "text", "text": prompt}]
                for p in image_paths[:4]:
                    data_url = _encode_image_to_data_url(p)
                    if data_url:
                        content_parts.append({"type": "image_url", "image_url": {"url": data_url}})

                def _run_vision():
                    resp = self._client.chat.completions.create(
                        model=self._settings.openai.model,
                        messages=[
                            {"role": "system", "content": "You are a clinical assistant generating pre-visit summaries. Do not make diagnoses."},
                            {"role": "user", "content": content_parts},
                        ],
                        max_tokens=min(2000, self._settings.openai.max_tokens),
                        temperature=0.3,
                    )
                    return resp.choices[0].message.content.strip()

                response = await asyncio.to_thread(_run_vision)
                return self._parse_summary_response(response)
            else:
                response = await self._chat_completion(
                    messages=[
                        {
                            "role": "system",
                            "content": "You are a clinical assistant generating pre-visit summaries. Do not make diagnoses.",
                        },
                        {"role": "user", "content": prompt},
                    ],
                    max_tokens=min(2000, self._settings.openai.max_tokens),
                    temperature=0.3,
                )
                return self._parse_summary_response(response)
        except Exception:
            return self._generate_fallback_summary(patient_data, intake_answers)

    # ----------------------
    # Helpers
    # ----------------------
    def _format_intake_answers(self, intake_answers: Dict[str, Any]) -> str:
        """Format intake answers for prompt."""
        if isinstance(intake_answers, dict) and "questions_asked" in intake_answers:
            formatted: List[str] = []
            for qa in intake_answers.get("questions_asked", []):
                q = qa.get("question", "N/A")
                a = qa.get("answer", "N/A")
                img = qa.get("attachment_image_path")
                img_note = " (image attached)" if img else ""
                formatted.append(f"Q: {q}\nA: {a}{img_note}\n")
            return "\n".join(formatted)
        return "\n".join([f"{k}: {v}" for k, v in intake_answers.items()])

    def _parse_summary_response(self, response: str) -> Dict[str, Any]:
        """Parse LLM response into structured format."""
        try:
            import json

            # Try to extract JSON from code fences if present
            if "```json" in response:
                json_start = response.find("```json") + 7
                json_end = response.find("```", json_start)
                json_str = response[json_start:json_end].strip()
                return json.loads(json_str)

            # Otherwise try plain JSON
            try:
                return json.loads(response)
            except Exception:
                pass

            # Fallback minimal structure
            return {"summary": response, "structured_data": {"chief_complaint": "See summary"}}
        except Exception:
            return {"summary": response, "structured_data": {"chief_complaint": "Unable to parse"}}

    def _generate_fallback_summary(
        self, patient_data: Dict[str, Any], intake_answers: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Basic fallback if OpenAI call fails."""
        return {
            "summary": f"Pre-visit summary for {patient_data.get('name', 'Patient')} - {patient_data.get('symptom', 'Chief Complaint')}",
            "structured_data": {
                "chief_complaint": patient_data.get("symptom", "N/A"),
                "key_findings": ["See intake responses"],
                "recommendations": ["Complete clinical examination"],
            },
        }