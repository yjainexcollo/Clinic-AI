"""
OpenAI implementation of QuestionService for AI-powered question generation.
"""

import asyncio
from typing import Any, Dict, List

from openai import OpenAI
import logging

from clinicai.application.ports.services.question_service import QuestionService
from clinicai.core.config import get_settings


class OpenAIQuestionService(QuestionService):
    """OpenAI implementation of QuestionService."""

    def __init__(self):
        import os
        from pathlib import Path

        try:
            from dotenv import load_dotenv  # type: ignore
        except Exception:
            load_dotenv = None  # optional fallback

        self._settings = get_settings()
        api_key = self._settings.openai.api_key or os.getenv("OPENAI_API_KEY", "")

        # If still empty, try loading .env manually (for environments where pydantic doesn't pick it up)
        if not api_key and load_dotenv is not None:
            # Look for a .env in CWD and parents up to repo root
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

        # Client uses explicit key to avoid relying on ambient env in different CWDs
        self._client = OpenAI(api_key=api_key)

    async def _chat_completion(
        self, messages: List[Dict[str, str]], max_tokens: int, temperature: float
    ) -> str:
        """Run sync OpenAI chat.completions in a thread to keep async API."""

        def _run():
            logger = logging.getLogger("clinicai")
            logger.info(
                "[QuestionService] Calling OpenAI chat.completions",
                extra={
                    "model": self._settings.openai.model,
                    "max_tokens": max_tokens,
                    "temperature": temperature,
                },
            )
            try:
                resp = self._client.chat.completions.create(
                    model=self._settings.openai.model,
                    messages=messages,
                    max_tokens=max_tokens,
                    temperature=temperature,
                )
                text = resp.choices[0].message.content.strip()
                logger.info("[QuestionService] OpenAI call succeeded")
                return text
            except Exception as e:
                logger.error("[QuestionService] OpenAI call failed", exc_info=True)
                raise

        return await asyncio.to_thread(_run)

    async def generate_first_question(self, disease: str) -> str:
        """Always start by asking the chief complaint after demographics are collected."""
        return "Why have you come in today? What is the main concern you want help with?"

    async def generate_next_question(
        self,
        disease: str,
        previous_answers: List[str],
        asked_questions: List[str],
        current_count: int,
        max_count: int,
    ) -> str:
        """Generate the next question based on context."""
        prompt = (
            f"Patient demographics have already been collected (name, mobile, age, gender, recently_travelled). \n"
            f"Chief complaint (if provided yet): {disease or 'N/A'}.\n"
            f"Previous answers (last 3): {', '.join(previous_answers[-3:])}.\n"
            f"Already asked: {asked_questions}.\n"
            f"Current question count: {current_count}/{max_count}.\n\n"
            "You are a medical intake assistant.\n\n"
            "TASK:\n"
            "- Ask ONE clear, symptom-focused, professional question.\n"
            "- Do NOT repeat questions or topics already covered in answers or 'Already asked'.\n"
            "- Do NOT ask demographics or travel again.\n"
            "- Select the next UNMET item from this exact sequence (skip any already answered):\n"
            "  1) Duration of symptoms.\n"
            "  2) Triggers / aggravating factors (exertion, food, stress, environment).\n"
            "  3) Pain assessment (only if pain is a symptom): location, duration (for pain), intensity (0–10), character, radiation, relieving/aggravating factors.\n"
            "  4) Travel history (ask if symptom suggests infectious relevance: fever/diarrhea/cough/breathlessness/rash/jaundice/etc.). Ask about last 1–3 months (domestic/international), endemic exposure, sick contacts.\n"
            "  5) Allergies (ask ONLY if symptom suggests allergic relevance: rash, swelling, hives, wheeze, sneezing, runny nose).\n"
            "  6) Medications & remedies used: prescribed and OTC (drug, dose, frequency, adherence) and any home/alternative remedies with effect (helped/worsened/no effect).\n"
            "  7) Past medical history (ONLY chronic diseases) and prior surgeries/hospitalizations when relevant.\n"
            "  8) Family history (ONLY for chronic/hereditary disease relevance).\n"
            "  9) Social history: smoking, alcohol, substances; diet and exercise; occupation and exposure risks.\n"
            " 10) Gynecologic / obstetric (ask only if relevant to a female patient).\n"
            " 11) Functional status (ask only if pain/mobility or neurologic impairment is likely—e.g., joint/back pain, arthritis, weakness, stroke, advanced COPD/CHF, or elderly): daily activities and caregiver/assistive needs.\n"
            "- Keep the question concise, specific, and clinically useful.\n"
            "- After finishing all applicable items or reaching the limit, stop.\n\n"
            "Return only the question text."
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
            f"Disease: {disease}. Questions asked: {current_count}/{max_count}.\n"
            f"Patient answers: {', '.join(previous_answers)}.\n"
            "Reply with only YES (sufficient) or NO (need more)."
        )

        try:
            reply = await self._chat_completion(
                messages=[
                    {
                        "role": "system",
                        "content": "You decide if intake is sufficient.",
                    },
                    {"role": "user", "content": prompt},
                ],
                max_tokens=8,
                temperature=0.0,
            )
            return reply.strip().upper().startswith("YES")
        except Exception:
            return current_count >= 5 or current_count >= max_count

    def _get_fallback_first_question(self, disease: str) -> str:
        """Fallback first question if OpenAI fails - always returns the same question."""
        return "Why have you come in today? What is the main concern you want help with?"

    def _get_fallback_next_question(self, disease: str, current_count: int) -> str:
        """Fallback next questions if OpenAI fails."""
        fallback_questions = [
            "How long have you been experiencing these symptoms?",
            "On a scale of 1-10, how would you rate the severity?",
            "Are there any activities that make the symptoms worse?",
            "Have you tried any treatments or medications?",
            "How is this affecting your daily activities?",
            "Are you experiencing any other associated symptoms?",
            "What time of day do the symptoms typically occur?",
            "Have you had similar symptoms before?",
            "Is there anything that seems to trigger these symptoms?",
            "How would you describe the quality of the symptoms?",
            "Are the symptoms constant or do they come and go?",
            "Have you noticed any patterns with these symptoms?",
        ]

        # Return a question based on current count
        if current_count < len(fallback_questions):
            return fallback_questions[current_count]
        else:
            return "Is there anything else you'd like to tell us about your condition?"

    async def generate_pre_visit_summary(
        self, 
        patient_data: Dict[str, Any], 
        intake_answers: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Generate pre-visit clinical summary from intake data."""
        gender = (patient_data.get('gender') or '').strip().lower()
        recently_travelled = bool(patient_data.get('recently_travelled', False))
        prompt = f"""
You are a clinical assistant. Create a concise pre-visit summary from the data below.

Patient Information:
- Name: {patient_data.get('name', 'N/A')}
- Age: {patient_data.get('age', 'N/A')}
- Gender: {patient_data.get('gender', 'N/A')}
- Mobile: {patient_data.get('mobile', 'N/A')}
- Recently travelled: {recently_travelled}

Intake Responses:
{self._format_intake_answers(intake_answers)}

STRICT REQUIREMENTS:
- Output MUST be MARKDOWN with section headings and bullet lists; no paragraphs.
- Every content line must start with "- ".
- REMOVE duplicate/repeated information.
- LENGTH must be 180 to 220 words total.
- Clinical, neutral tone; do not diagnose.
- Include a section ONLY if there is information for it; omit empty sections.
- Include Gynecologic / Obstetric History only if gender is female.
- Include Travel History only if Recently travelled is true and details exist.

Use these exact headings, in this order (skip any that have no data):
1) Chief Complaint
2) History of Present Illness
3) Pain Assessment
4) Travel History
5) Allergies
6) Medications and Remedies Used
7) Past Medical History
8) Family History
9) Social History
10) Gynecologic / Obstetric History
11) Functional Status
12) Key Clinical Points

Content guidance per section:
- History of Present Illness: duration, severity, triggers, associated symptoms, impact on daily life.
- Pain Assessment: location, duration (for pain), intensity (0–10), character, radiation, relieving/aggravating factors.
- Travel History: only include if recently_travelled true and relevant details exist.
- Allergies: include only when clinically relevant; specify agent and reaction.
- Medications and Remedies Used: drug, dose, frequency, adherence; remedies and effect.
- Past Medical History: chronic diseases; prior surgeries/hospitalizations; special exposure risks (recent hospitals/surgeries, occupational hazards, animal bites/pets).
- Family History: only include for chronic/hereditary disease relevance.

OUTPUT FORMAT (JSON fenced exactly):
```json
{{
  "summary": "<markdown with headings and bullet points only>",
  "structured_data": {{
    "chief_complaint": "...",
    "key_findings": ["..."]
  }}
}}
```
"""
        
        try:
            response = await self._chat_completion(
                messages=[
                    {
                        "role": "system", 
                        "content": "You are a clinical assistant generating pre-visit summaries. Focus on accuracy, completeness, and clinical relevance. Do not make diagnoses."
                    },
                    {"role": "user", "content": prompt}
                ],
                max_tokens=min(2000, self._settings.openai.max_tokens),
                temperature=0.3  # Lower temperature for more consistent medical summaries
            )
            
            # Parse and normalize the response
            raw = self._parse_summary_response(response)
            return self._normalize_summary_result(raw)
            
        except Exception as e:
            # Fallback to basic summary
            return self._generate_fallback_summary(patient_data, intake_answers)

    def _format_intake_answers(self, intake_answers: Dict[str, Any]) -> str:
        """Format intake answers for prompt."""
        if isinstance(intake_answers, dict) and 'questions_asked' in intake_answers:
            # Handle structured intake data
            formatted = []
            for qa in intake_answers['questions_asked']:
                formatted.append(f"Q: {qa.get('question', 'N/A')}")
                formatted.append(f"A: {qa.get('answer', 'N/A')}")
                formatted.append("")
            return "\n".join(formatted)
        else:
            # Handle simple key-value answers
            return "\n".join([f"{k}: {v}" for k, v in intake_answers.items()])

    def _parse_summary_response(self, response: str) -> Dict[str, Any]:
        """Parse LLM response into structured format."""
        try:
            import json
            # Try to extract JSON from response
            if "```json" in response:
                json_start = response.find("```json") + 7
                json_end = response.find("```", json_start)
                json_str = response[json_start:json_end].strip()
                return json.loads(json_str)
            else:
                # Fallback to basic structure
                return {
                    "summary": response,
                    "structured_data": {
                        "chief_complaint": "See summary",
                        "key_findings": ["See summary"],
                        "recommendations": ["See summary"]
                    }
                }
        except Exception:
            return {
                "summary": response,
                "structured_data": {
                    "chief_complaint": "Unable to parse",
                    "key_findings": ["See summary"],
                    "recommendations": ["See summary"]
                }
            }

    def _generate_fallback_summary(self, patient_data: Dict[str, Any], intake_answers: Dict[str, Any]) -> Dict[str, Any]:
        """Generate basic fallback summary."""
        return {
            "summary": f"Pre-visit summary for {patient_data.get('name', 'Patient')}",
            "structured_data": {
                "chief_complaint": patient_data.get('symptom') or patient_data.get('complaint') or "N/A",
                "key_findings": ["See intake responses"]
            }
        }

    def _normalize_summary_result(self, result: Dict[str, Any]) -> Dict[str, Any]:
        """Ensure result contains 'summary' and 'structured_data' keys with sane defaults."""
        normalized: Dict[str, Any] = {}
        if not isinstance(result, dict):
            return self._generate_fallback_summary({}, {})

        # Map possible variants
        summary = result.get("summary") or result.get("markdown") or result.get("content") or ""
        structured = result.get("structured_data") or result.get("structuredData") or result.get("data") or {}

        # Ensure types
        if not isinstance(summary, str):
            summary = str(summary)
        if not isinstance(structured, dict):
            structured = {"raw": structured}

        # Minimal required fields
        if "chief_complaint" not in structured:
            structured["chief_complaint"] = "See summary"
        if "key_findings" not in structured:
            structured["key_findings"] = ["See summary"]

        normalized["summary"] = summary
        normalized["structured_data"] = structured
        return normalized

    def is_medication_question(self, question: str) -> bool:
        """Check if a question is about medications and allows image upload."""
        if not question:
            return False
        
        question_lower = question.lower()
        
        # Keywords that indicate medication-related questions
        medication_keywords = [
            "medication", "medicine", "drug", "prescription", "tablet", "pill", 
            "dose", "dosage", "treatment", "remedy", "medication", "pharmacy",
            "over-the-counter", "otc", "prescribed", "taking", "current medications",
            "what medications", "any medications", "medications you", "drugs you"
        ]
        
        # Check if any medication keywords are present
        for keyword in medication_keywords:
            if keyword in question_lower:
                return True
        
        # Check for specific patterns that suggest medication questions
        medication_patterns = [
            "what are you taking",
            "are you taking any",
            "current treatments",
            "any remedies",
            "home remedies",
            "alternative treatments",
            "over the counter",
            "prescribed medications",
            "medication adherence",
            "how often do you take",
            "when do you take",
            "medication side effects",
            "drug interactions"
        ]
        
        for pattern in medication_patterns:
            if pattern in question_lower:
                return True
        
        return False