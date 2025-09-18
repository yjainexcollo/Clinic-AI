"""
OpenAI implementation of QuestionService for AI-powered question generation.
"""

import asyncio
import logging
import re
from typing import Any, Dict, List

from openai import OpenAI

from clinicai.application.ports.services.question_service import QuestionService
from clinicai.core.config import get_settings


class OpenAIQuestionService(QuestionService):
    """OpenAI-based implementation of the QuestionService for intake question generation."""

    def __init__(self) -> None:
        """Initialize service, load environment variables, and configure OpenAI client."""
        import os
        from pathlib import Path

        try:
            # dotenv is optional but helps in local development
            from dotenv import load_dotenv  # type: ignore
        except Exception:
            load_dotenv = None  # optional fallback

        # Load project settings (includes model name, tokens, temperature, etc.)
        self._settings = get_settings()

        # Look for API key in settings or environment
        api_key = self._settings.openai.api_key or os.getenv("OPENAI_API_KEY", "")
        # Question generation mode: 'autonomous' (default) or 'guided'
        self._mode = (os.getenv("QUESTION_MODE", "autonomous") or "autonomous").strip().lower()

        # If key not found, attempt to manually load from .env in current or parent dirs
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

        # Explicit client initialization avoids relying on ambient env
        self._client = OpenAI(api_key=api_key)

    async def _chat_completion(
        self, messages: List[Dict[str, str]], max_tokens: int, temperature: float
    ) -> str:
        """Wrapper for OpenAI chat.completions with logging and async support."""

        def _run() -> str:
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
            except Exception:
                logger.error("[QuestionService] OpenAI call failed", exc_info=True)
                raise

        return await asyncio.to_thread(_run)

    # ----------------------
    # Shared classifier
    # ----------------------
    def _classify_question(self, text: str) -> str:
        """
        Classify a question into one of the structured intake categories.
        """
        t = (text or "").lower().strip()

        if any(k in t for k in ["how long", "since when", "duration"]):
            return "duration"
        if any(k in t for k in ["trigger", "worse", "aggrav", "what makes", "factors"]):
            return "triggers"
        if any(
            k in t
            for k in [
                "temporal",
                "time of day",
                "morning",
                "evening",
                "night",
                "day",
                "seasonal",
                "cyclical",
                "worse at",
                "better at",
                "timing",
                "when does",
                "what time",
            ]
        ):
            return "temporal"
        if "pain" in t or any(
            k in t
            for k in [
                "scale",
                "intensity",
                "sharp",
                "dull",
                "burning",
                "throbbing",
                "radiat",
                "radiation",
                "move",
                "stay in one location",
                "travels",
                "spreads",
            ]
        ):
            return "pain"
        if any(k in t for k in ["travel", "endemic", "abroad", "sick contact"]):
            return "travel"
        if any(k in t for k in ["allerg", "hives", "rash", "swelling", "wheeze", "sneeze", "runny nose"]):
            return "allergies"
        if any(
            k in t
            for k in [
                "medicat",
                "treatment",
                "drug",
                "dose",
                "frequency",
                "prescript",
                "otc",
                "over-the-counter",
                "supplement",
                "supplements",
                "remedy",
                "remedies",
                "route",
                "oral",
                "topical",
                "injection",
                "how often",
                "medication name",
                "effectiveness",
            ]
        ):
            return "medications"
        if any(
            k in t
            for k in [
                "history of present illness",
                "hpi",
                "chronic",
                "past medical",
                "medical history",
                "prior conditions",
                "surgery",
                "hospitalization",
                "diabetes",
                "hypertension",
                "heart disease",
                "asthma",
                "copd",
                "cancer",
                "stroke",
            ]
        ):
            return "hpi"
        if any(k in t for k in ["family", "family history", "anyone in your family", "parents", "siblings", "grandparents", "hereditary", "genetic"]):
            return "family"
        if any(k in t for k in ["smoke", "alcohol", "diet", "exercise", "occupation", "work", "exposure"]):
            return "social"
        if any(k in t for k in ["pregnan", "gyneco", "obstet", "menstru", "period"]):
            return "gyn"
        if any(k in t for k in ["functional", "mobility", "walk", "daily activity", "impair", "neurologic"]):
            return "functional"

        return "other"

    # ----------------------
    # Question generation
    # ----------------------
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
        recently_travelled: bool = False,
    ) -> str:
        """
        Generate the next intake question using structured sequence and context.
        """
        mandatory_closing = "Have we missed anything important about your condition or any concerns you want us to address?"
        if current_count >= max_count - 1:
            already_asked = any(
                mandatory_closing.lower() in (q or "").lower() for q in (asked_questions or [])
            )
            if not already_asked:
                return mandatory_closing

        # Build prompt with category applicability and duplicate prevention
        covered_categories = sorted({self._classify_question(q) for q in (asked_questions or []) if q})
        covered_categories_str = ", ".join(c for c in covered_categories if c and c != "other") or "none"

        prompt = f"""
SYSTEM PROMPT:
You are a professional, respectful, and efficient clinical intake assistant.
Ask one concise, medically relevant question at a time.
Never repeat or rephrase already asked questions or categories.

CONTEXT:
- Chief complaint(s): {disease or "N/A"}
- Last 3 patient answers: {', '.join(previous_answers[-3:])}
- Already asked questions: {asked_questions}
- Covered categories: {covered_categories_str}
- Progress: {current_count}/{max_count}
- Recently travelled: {recently_travelled} (true/false)

STRICT PRIORITY RULES:
1. Do not repeat any question, topic, or meaning from "Already asked questions" or Covered categories.
2. Ask ONLY if the category is relevant to current symptoms:
   - Pain → ONLY if pain is explicitly reported by the patient.
   - Allergies → ONLY if allergy features exist (rash, swelling, hives, wheeze, sneeze, runny nose). Do NOT ask allergies solely due to chronic diseases (e.g., diabetes) unless the patient mentioned allergy issues or such features.
   - Triggers → Skip if complaint is ONLY a chronic disease (e.g., diabetes, hypertension) with no acute symptoms.
   - Family history → ONLY if a hereditary/chronic condition exists (e.g., diabetes, hypertension, cancer, autoimmune, blood/neurologic/genetic disorders).
   - HPI → ONLY if acute/new symptoms exist (e.g., fever, cough, chest pain, infection, stomach pain). Do NOT ask if only stable chronic disease is present.
   - Gynecologic/obstetric → ONLY if female (age 10–60) AND symptoms suggest menstrual/pregnancy relevance.
3. If a category is irrelevant, skip it completely and move to the next one.
4. Never combine categories. Each turn = exactly ONE category question.
5. For multiple complaints, consolidate into ONE comprehensive question for that category (not multiple).

SEQUENCE OF QUESTIONS (ask in this order if relevant and unasked):
1) Duration of symptoms (overall).
2) Triggers (overall).
3) Pain (if pain present).
4) Temporal factors.
5) Travel history (ONLY if recently_travelled = true AND infection-relevant symptoms).
6) Allergies (ONLY if allergy relevance exists).
7) Medications & remedies.
8) HPI (ONLY if acute/new symptoms exist).
9) Family history (ONLY if chronic/hereditary condition present).
10) Lifestyle (if clinically relevant).
11) Gynecologic/obstetric (ONLY for females 10–60 with abdominal/reproductive symptoms).
12) Functional status (ONLY if pain/mobility/neurologic impairment likely).

STOP LOGIC:
- Stop immediately if current_count >= max_count.
- Always stop after at least 6 questions have been asked AND enough info is collected.
- Do NOT continue asking irrelevant categories just to reach the end of the list.

MANDATORY CLOSING QUESTION:
When stopping, always end with:
"Have we missed anything important about your condition or any concerns you want us to address?"

OUTPUT RULES:
- Return ONLY one question ending with a question mark.
- No explanations, no multiple questions in one turn.
- Never merge Duration + Triggers into the same question.
- Never force irrelevant questions just to fill the sequence.



# Example: model config
settings = {
    "temperature": 0.2,
    "max_tokens": 256
}

"""

        try:
            text = await self._chat_completion(
                messages=[
                    {"role": "system", "content": "You are a clinical intake assistant. Follow instructions strictly."},
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
            raise

    # ----------------------
    # Stop logic
    # ----------------------
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
        if current_count < 6:
            return False
        return False

    # ----------------------
    # Completion percent
    # ----------------------
    async def assess_completion_percent(
        self,
        disease: str,
        previous_answers: List[str],
        asked_questions: List[str],
        current_count: int,
        max_count: int,
    ) -> int:
        """Estimate completion percent."""
        try:
            covered = {self._classify_question(q) for q in (asked_questions or [])}

            key_set = {
                "duration",
                "triggers",
                "temporal",
                "pain",
                "travel",
                "allergies",
                "medications",
                "hpi",
                "family",
                "social",
                "gyn",
                "functional",
            }

            covered_keys = len(covered & key_set)
            coverage_ratio = covered_keys / len(key_set)

            progress_ratio = 0.0
            if max_count > 0:
                progress_ratio = min(max(current_count / max_count, 0.0), 1.0)

            score = (0.7 * coverage_ratio + 0.3 * progress_ratio) * 100.0
            return max(0, min(int(round(score)), 100))
        except Exception:
            if max_count <= 0:
                return 0
            return max(0, min(int(round((current_count / max_count) * 100.0)), 100))

    # ----------------------
    # Medication check
    # ----------------------
    def is_medication_question(self, question: str) -> bool:
        """Detect if a question is about medications, remedies, or treatments."""
        return self._classify_question(question) == "medications"
    # ----------------------
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
            "- Normalize obvious medical mispronunciations to correct terms (e.g., \"die-a-bee-tees mellitis\" → \"diabetes mellitus\") without adding new information.\n\n"
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
