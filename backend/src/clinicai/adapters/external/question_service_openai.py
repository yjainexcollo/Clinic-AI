import asyncio
import logging
from typing import Any, Dict, List, Optional

from openai import OpenAI
from clinicai.application.ports.services.question_service import QuestionService
from clinicai.core.config import get_settings


# ----------------------
# Question Templates (Fallbacks)
# ----------------------
QUESTION_TEMPLATES: Dict[str, str] = {
    "duration": "How long have you been experiencing these symptoms?",
    "triggers": "What makes your symptoms better or worse, such as activity, food, or stress?",
    "pain": "If you have any pain, tell the location, duration, intensity (0–10), character, radiation, and relieving/aggravating factors.",
    "temporal": "Do your symptoms vary by timing patterns (morning/evening, night/day, seasonal/cyclical)?",
    "travel": "Have you travelled in the last 1–3 months? If yes, where did you go, and did you eat unsafe food or drink untreated water?",
    "allergies": "Do you have any allergies such as rash, hives, swelling, wheeze, sneezing, or runny nose?",
    "medications": "What medications or remedies are you currently taking? Please include prescribed drugs, OTC, supplements, or home remedies.",
    "hpi": "Have you had any recent acute symptoms like fever, cough, chest pain, stomach pain, or infection?",
    "family": "Does anyone in your family have diabetes, hypertension, heart disease, cancer, or similar conditions?",
    "lifestyle": "Can you describe your typical diet, exercise, or lifestyle habits?",
    "gyn": "When was your last menstrual period and are your cycles regular?",
    "functional": "Do your symptoms affect your daily activities or mobility?",
}


# ----------------------
# OpenAI QuestionService
# ----------------------
class OpenAIQuestionService(QuestionService):
    def __init__(self) -> None:
        import os
        from pathlib import Path
        from dotenv import load_dotenv

        self._settings = get_settings()
        self._debug_prompts = getattr(self._settings, "debug_prompts", False)

        api_key = self._settings.openai.api_key or os.getenv("OPENAI_API_KEY", "")
        if not api_key:
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
        self, messages: List[Dict[str, str]], max_tokens: int = 64, temperature: float = 0.3
    ) -> str:
        def _run() -> str:
            logger = logging.getLogger("clinicai")
            try:
                if self._debug_prompts:
                    logger.debug("[QuestionService] Sending messages to OpenAI:\n%s", messages)

                resp = self._client.chat.completions.create(
                    model=self._settings.openai.model,
                    messages=messages,
                    max_tokens=max_tokens,
                    temperature=temperature,
                )
                output = resp.choices[0].message.content.strip()

                if self._debug_prompts:
                    logger.debug("[QuestionService] Received response: %s", output)

                return output
            except Exception:
                logger.error("[QuestionService] OpenAI call failed", exc_info=True)
                return ""

        return await asyncio.to_thread(_run)

    async def generate_first_question(self, disease: str) -> str:
        """Use AI to generate the opening question."""
        base_question = "Why have you come in today? What is the main concern you want help with?"

        messages = [
            {
                "role": "system",
                "content": (
                    "You are a clinical intake assistant. Generate the first short, open-ended question "
                    "to begin the consultation. Output only the question."
                ),
            },
            {
                "role": "user",
                "content": f"Patient complaint: {disease or 'Not specified'}\nExample: {base_question}\n\nGenerate a similar question."
            },
        ]

        ai_question = await self._chat_completion(messages, max_tokens=32, temperature=0.2)
        return ai_question or base_question

    async def generate_next_question(
        self,
        disease: str,
        previous_answers: List[str],
        asked_questions: List[str],
        current_count: int,
        max_count: int,
        asked_categories: Optional[List[str]] = None,
        recently_travelled: bool = False,
        prior_summary: Any | None = None,
        prior_qas: List[str] | None = None,
    ) -> str:
        logger = logging.getLogger("clinicai")
        mandatory_closing = "Have we missed anything important about your condition or any concerns you want us to address?"

        # --- Stop Logic ---
        # Hard cap at 10 to avoid overly long sessions
        if current_count >= 10:
            return mandatory_closing

        # ---------------------
        # Normal AI question flow
        # ---------------------
        messages = [
            {
                "role": "system",
                "content": (
                    "You are a clinical intake assistant. Your job is to ask the patient the most relevant "
                    "next question to build a complete medical history. "
                    "Always keep the question short, clear, and clinically useful. "
                    "Output only the question, nothing else."
                ),
            },
            {
                "role": "user",
                "content": (
                    f"Patient complaint: {disease or 'Not specified'}\n"
                    f"Patient answers so far: {previous_answers or 'None'}\n"
                    f"Questions already asked: {asked_questions or 'None'}\n\n"
                    "Generate the next best question. "
                    "Prefer from categories: duration, triggers, pain, temporal pattern, travel, medications, "
                    "allergies, family history, lifestyle, gynecologic, functional limitations, or acute symptoms (HPI). "
                    "Do not repeat already asked questions."
                ),
            },
        ]

        ai_question = await self._chat_completion(messages, max_tokens=64, temperature=0.3)

        # Fallback if AI fails or repeats
        if not ai_question or ai_question in (asked_questions or []):
            for _, template in QUESTION_TEMPLATES.items():
                if template not in asked_questions:
                    return template
            return mandatory_closing

        return ai_question.strip()

    async def should_stop_asking(
        self,
        disease: str,
        previous_answers: List[str],
        current_count: int,
        max_count: int,
    ) -> bool:
        """Stop at 10 max. Between 7–9, AI decides dynamically inside generate_next_question."""
        return current_count >= 10

    async def assess_completion_percent(
        self,
        disease: str,
        previous_answers: List[str],
        asked_questions: List[str],
        current_count: int,
        max_count: int,
        asked_categories: Optional[List[str]] = None,
        prior_summary: Any | None = None,
        prior_qas: List[str] | None = None,
    ) -> int:
        """Heuristic: min 7 → 70%, max 10 → 100%"""
        ratio = min(current_count, 10) / 10
        return int(ratio * 100)

    def is_medication_question(self, question: str) -> bool:
        return "medication" in (question or "").lower() or "drug" in (question or "").lower()

    # Pre-visit summary
    # ----------------------
    async def generate_pre_visit_summary(
        self,
        patient_data: Dict[str, Any],
        intake_answers: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Generate pre-visit clinical summary from intake data (concise bullets)."""
        prompt = (
            "Role & Task\n"
            "You are a Clinical Intake Assistant.\n"
            "Your task is to generate a concise, clinically useful Pre-Visit Summary (~180–200 words) based strictly on the provided intake responses.\n\n"
            "Critical Rules\n"
            "- Do not invent, guess, or expand beyond the provided input.\n"
            "- Output must be plain text with section headings, one section per line (no extra blank lines).\n"
            "- Use only the exact headings listed below. Do not add, rename, or reorder headings.\n"
            "- No bullets, numbering, or markdown formatting.\n"
            "- Write in a clinical handover tone: short, factual, deduplicated, and neutral.\n"
            "- Include a section only if it contains content; omit sections with no data.\n"
            "- Do not use placeholders like \"N/A\" or \"Not provided\".\n"
            "- Use patient-facing phrasing: \"Patient reports …\", \"Denies …\", \"On meds: …\".\n"
            "- Do not include clinician observations, diagnoses, plans, vitals, or exam findings (previsit is patient-reported only).\n"
            '- Normalize obvious medical mispronunciations to correct terms (e.g., "diabetes mellitus" -> "diabetes mellitus") without adding new information.\n\n'
            "Headings (use EXACT casing; include only if you have data)\n"
            "Chief Complaint:\n"
            "HPI:\n"
            "History:\n"
            "Current Medication:\n\n"
            "Content Guidelines per Section\n"
            "- Chief Complaint: One line in the patient’s own words if available.\n"
            "- HPI: ONE readable paragraph weaving OLDCARTS into prose:\n"
            "  Onset, Location, Duration, Characterization/quality, Aggravating factors, Relieving factors, Radiation,\n"
            "  Temporal pattern, Severity (1–10), Associated symptoms, Relevant negatives.\n"
            "  Keep it natural and coherent (e.g., \"The patient reports …\"). If some OLDCARTS elements are unknown, simply omit them (do not write placeholders).\n"
            "- History: One line combining any patient-reported items using semicolons in this order if present:\n"
            "  Medical: …; Surgical: …; Family: …; Social: …\n"
            "  (Include only parts provided by the patient; omit absent parts entirely.)\n"
            "- Review of Systems: One narrative line summarizing system-based positives/negatives explicitly mentioned by the patient (e.g., General, Neuro, Eyes, Resp, GI). Keep as prose, not a list.\n"
            "- Current Medication: One narrative line with meds/supplements actually stated by the patient (name/dose/frequency if provided). Include allergy statements only if the patient explicitly reported them.\n\n"
            "Example Format\n"
            "(Structure and tone only—content will differ; each section on a single line.)\n"
            "Chief Complaint: Patient reports severe headache for 3 days.\n"
            "HPI: The patient describes a week of persistent headaches that begin in the morning and worsen through the day, reaching up to 8/10 over the last 3 days. Pain is over both temples and feels different from prior migraines; fatigue is prominent and nausea is denied. Episodes are aggravated by stress and later in the day, with minimal relief from over-the-counter analgesics and some relief using cold compresses. No radiation is reported, evenings are typically worse, and there have been no recent changes in medications or lifestyle.\n"
            "History: Medical: hypertension; Surgical: cholecystectomy five years ago; Family: not reported; Social: non-smoker, occasional alcohol, high-stress job.\n"
            "Current Medication: On meds: lisinopril 10 mg daily and ibuprofen as needed; allergies included only if the patient explicitly stated them.\n\n"
            f"Intake Responses:\n{self._format_intake_answers(intake_answers)}"
        )

        try:
            response = await self._chat_completion(
                messages=[
                    {
                        "role": "system",
                        "content": (
                            "You are a clinical assistant generating pre-visit summaries. Focus on accuracy, completeness, "
                            "and clinical relevance. Do not make diagnoses."
                        ),
                    },
                    {"role": "user", "content": prompt},
                ],
                max_tokens=min(2000, self._settings.openai.max_tokens),
                temperature=0.3,
            )
            cleaned = self._clean_summary_markdown(response)
            return {
                "summary": cleaned,
                "structured_data": {
                    "chief_complaint": "See summary",
                    "key_findings": ["See summary"],
                },
            }
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
                formatted.append(f"Q: {q}")
                formatted.append(f"A: {a}")
                formatted.append("")
            return "\n".join(formatted)
        return "\n".join([f"{k}: {v}" for k, v in intake_answers.items()])

    def _parse_summary_response(self, response: str) -> Dict[str, Any]:
        """Parse LLM response into structured format (JSON if present)."""
        try:
            import json
            import re

            text = (response or "").strip()

            # 1) Prefer fenced ```json ... ```
            fence_json = re.search(r"```json\s*([\s\S]*?)\s*```", text, re.IGNORECASE)
            if fence_json:
                candidate = fence_json.group(1).strip()
                return json.loads(candidate)

            # 2) Any fenced block without language
            fence_any = re.search(r"```\s*([\s\S]*?)\s*```", text)
            if fence_any:
                candidate = fence_any.group(1).strip()
                try:
                    return json.loads(candidate)
                except Exception:
                    pass

            # 3) Raw JSON between first '{' and last '}'
            first = text.find("{")
            last = text.rfind("}")
            if first != -1 and last != -1 and last > first:
                candidate = text[first : last + 1]
                return json.loads(candidate)

            # Fallback to basic structure
            return {
                "summary": text,
                "structured_data": {
                    "chief_complaint": "See summary",
                    "key_findings": ["See summary"],
                    "recommendations": ["See summary"],
                },
            }
        except Exception:
            return {
                "summary": response,
                "structured_data": {
                    "chief_complaint": "Unable to parse",
                    "key_findings": ["See summary"],
                },
            }

    def _generate_fallback_summary(self, patient_data: Dict[str, Any], intake_answers: Dict[str, Any]) -> Dict[str, Any]:
        """Generate basic fallback summary."""
        return {
            "summary": f"Pre-visit summary for {patient_data.get('name', 'Patient')}",
            "structured_data": {
                "chief_complaint": patient_data.get("symptom") or patient_data.get("complaint") or "N/A",
                "key_findings": ["See intake responses"],
            },
        }

    def _normalize_summary_result(self, result: Dict[str, Any]) -> Dict[str, Any]:
        """Ensure result contains 'summary' and 'structured_data' keys with sane defaults."""
        if not isinstance(result, dict):
            return self._generate_fallback_summary({}, {})

        summary = result.get("summary") or result.get("markdown") or result.get("content") or ""
        structured = result.get("structured_data") or result.get("structuredData") or result.get("data") or {}

        if not isinstance(summary, str):
            summary = str(summary)
        if not isinstance(structured, dict):
            structured = {"raw": structured}

        if "chief_complaint" not in structured:
            structured["chief_complaint"] = "See summary"
        if "key_findings" not in structured:
            structured["key_findings"] = ["See summary"]

        # Attempt extraction from markdown if missing
        def _extract_from_markdown(md: str) -> Dict[str, Any]:
            data: Dict[str, Any] = {}
            current_section = None
            key_findings: List[str] = []
            chief_bullets: List[str] = []
            for raw in (md or "").splitlines():
                line = raw.strip()
                if line.startswith("## "):
                    title = line[3:].strip().lower()
                    if "key clinical points" in title:
                        current_section = "key_points"
                    elif "chief complaint" in title:
                        current_section = "chief"
                    else:
                        current_section = None
                    continue
                if line.startswith("- "):
                    text = line[2:].strip()
                    if current_section == "key_points" and text:
                        key_findings.append(text)
                    if current_section == "chief" and text:
                        chief_bullets.append(text)
            if key_findings:
                data["key_findings"] = key_findings
            if chief_bullets:
                data["chief_complaint"] = ", ".join(chief_bullets)
            return data

        if structured.get("key_findings") == ["See summary"] or not structured.get("key_findings"):
            extracted = _extract_from_markdown(summary)
            if extracted.get("key_findings"):
                structured["key_findings"] = extracted["key_findings"]
            if extracted.get("chief_complaint") and structured.get("chief_complaint") in (None, "See summary", "N/A"):
                structured["chief_complaint"] = extracted["chief_complaint"]

        return {"summary": summary, "structured_data": structured}

    def _clean_summary_markdown(self, summary_md: str) -> str:
        """Remove placeholder lines like [Insert ...] and drop now-empty sections."""
        if not isinstance(summary_md, str) or not summary_md.strip():
            return summary_md
        lines = summary_md.splitlines()
        cleaned: List[str] = []
        current_section_start = -1
        section_has_bullets = False

        def flush_section() -> None:
            nonlocal current_section_start, section_has_bullets
            if current_section_start == -1:
                return
            if not section_has_bullets:
                if cleaned:
                    cleaned.pop()
            current_section_start = -1
            section_has_bullets = False

        for raw in lines:
            line = raw.rstrip()
            if line.startswith("## ") or line.startswith("# "):
                flush_section()
                current_section_start = len(cleaned)
                section_has_bullets = False
                cleaned.append(line)
                continue
            low = line.lower()
            if "[insert" in low:
                continue
            if line.strip().startswith("- "):
                section_has_bullets = True
                cleaned.append(line)
            else:
                cleaned.append(line)
        flush_section()
        return "\n".join(cleaned)

