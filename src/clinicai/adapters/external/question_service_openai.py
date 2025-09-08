"""
OpenAI implementation of QuestionService for AI-powered question generation.
"""

import asyncio
from typing import Dict, List

from openai import OpenAI

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
            resp = self._client.chat.completions.create(
                model=self._settings.openai.model,
                messages=messages,
                max_tokens=max_tokens,
                temperature=temperature,
            )
            return resp.choices[0].message.content.strip()

        return await asyncio.to_thread(_run)

    async def generate_first_question(self, disease: str) -> str:
        """Generate the first question based on disease/complaint."""
        prompt = (
            f"You are a medical assistant helping with patient intake. The patient has reported: {disease}.\n"
            "Generate the first symptom-focused question to gather more information about their condition.\n"
            "The question must be: clear, symptom-focused, professional, friendly, and a single question.\n"
            "Return only the question text."
        )

        try:
            text = await self._chat_completion(
                messages=[
                    {
                        "role": "system",
                        "content": "You are a helpful medical assistant for patient intake.",
                    },
                    {"role": "user", "content": prompt},
                ],
                max_tokens=min(256, self._settings.openai.max_tokens),
                temperature=float(self._settings.openai.temperature),
            )
            # Ensure it's a single, well-punctuated question
            text = text.replace("\n", " ").strip()
            if not text.endswith("?"):
                text = text.rstrip(".") + "?"
            return text
        except Exception:
            return self._get_fallback_first_question(disease)

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
            f"Patient complaint: {disease}.\n"
            f"Previous answers (last 3): {', '.join(previous_answers[-3:])}.\n"
            f"Already asked questions: {asked_questions}.\n"
            f"Current question count: {current_count}/{max_count}.\n"
            "Generate the next symptom-focused question that is not a repeat, "
            "builds on prior answers, and is a single question.\n"
            "Focus on duration, severity, triggers, associated symptoms, impact "
            "on daily life, and prior treatments.\n"
            "Return only the question text."
        )

        try:
            text = await self._chat_completion(
                messages=[
                    {
                        "role": "system",
                        "content": "You are a helpful medical assistant. Never repeat questions.",
                    },
                    {"role": "user", "content": prompt},
                ],
                max_tokens=min(256, self._settings.openai.max_tokens),
                temperature=float(self._settings.openai.temperature),
            )
            text = text.replace("\n", " ").strip()
            if not text.endswith("?"):
                text = text.rstrip(".") + "?"
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
        """Fallback first questions if OpenAI fails."""
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
