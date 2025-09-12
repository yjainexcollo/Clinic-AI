"""OpenAI implementation of QuestionService for AI-powered question generation."""
import asyncio
import os
import logging
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
            "- Never repeat a question already asked.\n"
            "- Never ask again about a topic that the patient has ALREADY mentioned in previous answers. "
            "For example, if the patient has already described frequent urination, weight loss, or fatigue, "
            "do not ask about those again.\n"
            "Adjust questions based on gender:\n"
            " • Female: If relevant, ask about menstrual cycle, pregnancy, menopause, or gynecological history.\n"
            " • Male: If relevant, ask about prostate health, sexual health, or male-specific issues.\n"
            " • Other: Use neutral phrasing, avoid gender assumptions, and focus on universal health questions."
            "- You must ensure the following mandatory areas are covered:\n"
            " 1. Allergies (always ask)\n"
            " 2. Current medicines or treatments taken for this problem (always ask)\n"
            " 3. Past history of the same problem (always ask)\n"
            " 4. Family history of similar health issues (ask only if the disease is serious or hereditary, "
            "like asthma, chest pain, diabetes, hypertension, cancer)\n"
            " 5. Impact on daily life (always ask, unless already answered)\n"
            " 6. Key associated symptoms (always ask, unless already answered)\n"
            " 7. Other essential intake details that a general physician would require.\n\n"
            " 8. If any of these have not been asked yet, prioritize them first.\n"
            "- IMPORTANT: When asking about past history:\n"
            " • For chronic diseases (diabetes, hypertension, asthma, cancer), ask about diagnosis time or complications.\n"
            " • For acute/recurrent problems (chest pain, fever, cough, headache), ask if similar episodes occurred before.\n"
            "- Do NOT use the phrase 'previous episodes' for chronic diseases.\n\n"
            "Focus on:\n"
            " • Duration\n"
            " • Severity\n"
            " • Triggers\n"
            " • Associated symptoms\n"
            " • Impact on daily life\n"
            " • Relevant past history\n"
            "Once mandatory areas are covered, ask the next best follow-up based on what the patient shared.\n\n"
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
        self, patient_data: Dict[str, Any], intake_answers: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Generate pre-visit clinical summary from intake data."""
        prompt = f"""
You are a clinical assistant. Create a concise pre-visit summary from the data below.

Patient Information:
- Name: {patient_data.get('name', 'N/A')}
- Age: {patient_data.get('age', 'N/A')}
- Gender: {patient_data.get('gender', 'N/A')}
- Mobile: {patient_data.get('mobile', 'N/A')}
- Complaint: {patient_data.get('disease') or patient_data.get('complaint', 'N/A')}

Intake Responses:
{self._format_intake_answers(intake_answers)}

STRICT REQUIREMENTS:
- The summary MUST be in MARKDOWN BULLET POINTS only (no paragraphs).
- Use section headings with bullet lists under each. Every content line must start with "- " or "* ".
- REMOVE duplicate/repeated information.
- LENGTH must be 180 to 220 words total.
- Clinical, neutral tone; do not diagnose.

Include these sections (with bullet points under each):
- Chief Complaint
- History of Present Illness (duration, severity, triggers, associated symptoms, explicit impact on daily life)
- Review of Systems (list all symptoms mentioned)
- Past Medical History (prior episodes or complications)
- Medications (drug name, dosage, frequency, and how long taken)
- Allergies (details)
- Family History (affected relatives and their disease)
- Social History
- Key Clinical Points (3–5 bullets)

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
            # Parse the response and return structured data
            return self._parse_summary_response(response)
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
            "summary": f"Pre-visit summary for {patient_data.get('name', 'Patient')} - {patient_data.get('disease', 'Complaint')}",
            "structured_data": {
                "chief_complaint": patient_data.get('disease', 'N/A'),
                "key_findings": ["See intake responses"]
            }
        }