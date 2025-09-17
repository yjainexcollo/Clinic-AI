"""
OpenAI implementation of QuestionService for AI-powered question generation.
"""

import asyncio
import logging
from typing import Any, Dict, List

from openai import OpenAI

from clinicai.application.ports.services.question_service import QuestionService
from clinicai.core.config import get_settings


class OpenAIQuestionService(QuestionService):
    """OpenAI implementation of QuestionService."""

    def __init__(self) -> None:
        import os
        from pathlib import Path

        try:
            from dotenv import load_dotenv  # type: ignore
        except Exception:
            load_dotenv = None  # optional fallback

        self._settings = get_settings()
        api_key = self._settings.openai.api_key or os.getenv("OPENAI_API_KEY", "")
        # Optional mode to adjust prompting behavior
        self._mode = (os.getenv("QUESTION_MODE", "autonomous") or "autonomous").strip().lower()

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
        """Generate the next question based on context."""
        import re
        from difflib import SequenceMatcher

        # Hard gating to ensure critical categories are asked when applicable
        symptom_text = (disease or "").lower()
        travel_keywords = [
            "fever",
            "diarrhea",
            "diarrhoea",
            "vomit",
            "vomiting",
            "stomach",
            "abdomen",
            "abdominal",
            "cough",
            "breath",
            "shortness of breath",
            "rash",
            "jaundice",
            "malaria",
            "dengue",
            "tb",
            "tuberculosis",
            "covid",
            "typhoid",
            "hepatitis",
            "chikungunya",
        ]
        travel_relevant = bool(recently_travelled) and any(k in symptom_text for k in travel_keywords)
        if travel_relevant and not any("travel" in (q or "").lower() for q in asked_questions):
            gi_related = any(
                k in symptom_text
                for k in ["diarrhea", "diarrhoea", "vomit", "vomiting", "stomach", "abdomen", "abdominal"]
            )
            if gi_related:
                return (
                    "Have you travelled in the last 1–3 months? If yes, where did you go, did you eat street food or "
                    "raw/undercooked foods, drink untreated water, or did others with you have similar stomach symptoms?"
                )
            return (
                "Have you travelled domestically or internationally in the last 1–3 months? If yes, where did you go, "
                "was it a known infectious area, and did you have any sick contacts?"
            )

        def _normalize(text: str) -> str:
            t = (text or "").lower().strip()
            t = re.sub(r"^(can you|could you|please|would you)\s+", "", t)
            t = re.sub(r"[\?\.!]+$", "", t)
            t = re.sub(r"\s+", " ", t)
            return t.strip()

        def _is_duplicate(candidate: str, history: List[str]) -> bool:
            cand_norm = _normalize(candidate)
            for h in history:
                h_norm = _normalize(h)
                if cand_norm == h_norm:
                    return True
                if SequenceMatcher(None, cand_norm, h_norm).ratio() >= 0.85:
                    return True
            return False

        # Prompt (autonomous vs guided)
        if self._mode == "autonomous":
            prompt = (
                f"Chief complaint: {disease or 'N/A'}. Last answers: {', '.join(previous_answers[-3:])}. "
                f"Already asked: {asked_questions}.\n"
                "Ask ONE concise, clinically relevant next question based on context.\n"
                "Do not repeat topics or demographics. Return only the question text."
            )
        else:
            prompt = f"""
SYSTEM PROMPT:
You are a professional, respectful, and efficient clinical intake assistant.
Ask one concise, medically relevant question at a time.
NEVER repeat or rephrase any already asked question or covered category.
CONTEXT:
- Chief complaint (if provided): {disease or "N/A"}
- Last three answers: {', '.join(previous_answers[-3:])}
- Already asked questions: {asked_questions}
- Covered categories (do NOT ask again): {covered_categories_str}
- Progress: {current_count}/{max_count}
- Recently travelled: {recently_travelled}
DUPLICATE PREVENTION:
- Do not repeat content or semantics of items in "Already asked questions".
- Do not select any category listed in Covered categories.
TASK:
Before choosing a category, CHECK ALL CURRENT COMPLAINTS/SYMPTOMS.
- Ask a category only if it applies to the overall presentation or its condition is met.
- Do NOT repeat the same category per symptom; cover categories once globally.
 - PRIORITIZE: If abdominal/stomach pain is present AND the patient is female (per collected demographics), ask a concise menstrual/gynecologic question next (cycle timing, last menstrual period, pregnancy possibility, relation of pain to menses).
Select the next UNASKED item from this sequence, skipping any already covered:
1) Duration of symptoms (overall course).
2) Triggers / aggravating or relieving factors (overall).
3) Pain assessment (ONLY if pain is present): location, duration, intensity (0–10), character, radiation, relieving/aggravating factors.
4) Temporal factors: timing patterns (morning/evening, night/day, seasonal/cyclical).
5) Travel history (ONLY if recently_travelled = true AND symptoms suggest infection: fever/diarrhea/cough/breathlessness/rash/jaundice).
6) Allergies (ONLY if allergic relevance: rash/swelling/hives/wheeze/sneeze/runny nose).
7) Medications & remedies: include medication name, dose, route, frequency; include OTC/supplements/home/alternative remedies with effectiveness.
8) History of Present Illness (HPI): ONLY if ANY chronic disease present; include relevant chronic conditions, past surgeries/hospitalizations.
9) Family history: ONLY if ANY current complaint is chronic/hereditary (diabetes/hypertension/heart disease/cancer/genetic-autoimmune-blood-neurologic). Skip for acute/non-genetic.
10) Social history: diet, exercise, lifestyle, occupation, exposures; ask if clinically relevant (e.g., thyroid present).
11) Gynecologic/obstetric (ONLY for female patients aged 10-60, if relevant). If female(10-60) with abdominal/stomach pain, ask about menstrual cycle (LMP, cycle regularity, pain relation to periods) and pregnancy possibility.
12) Functional status (ONLY if pain/mobility or neurologic impairment likely).
STOP LOGIC:
- Keep asking until at least 6 questions are asked; always stop at max_count.
- If sufficient info and >=6, ask the mandatory closing question and stop.
MANDATORY CLOSING QUESTION (final when stopping):
"Have we missed anything important about your condition or any concerns you want us to address?"
OUTPUT RULES:
- Return ONLY one question ending with a question mark.
- No explanations or multiple questions.
""" 

        try:
            text = await self._chat_completion(
                messages=[
                    {"role": "system", "content": "You are a clinical intake assistant. Never repeat prior questions."},
                    {"role": "user", "content": prompt},
                ],
                max_tokens=min(256, self._settings.openai.max_tokens),
                temperature=float(self._settings.openai.temperature),
            )
            text = text.replace("\n", " ").strip()
            if not text.endswith("?"):
                text = text.rstrip(".") + "?"
            # Return model output directly (no local fallbacks)
            return text
        except Exception:
            # Let upstream handle errors (no fallback questions)
            raise

    async def should_stop_asking(
        self,
        disease: str,
        previous_answers: List[str],
        current_count: int,
        max_count: int,
        recently_travelled: bool = False,
    ) -> bool:
        """Determine if sufficient information has been collected."""
        # Always stop at the hard cap
        if current_count >= max_count:
            return True
        # Require a small minimum before stopping early
        if current_count < 6:
            return False
        # Otherwise continue until near cap
        return current_count >= (max_count - 1)

    async def assess_completion_percent(
        self,
        disease: str,
        previous_answers: List[str],
        asked_questions: List[str],
        current_count: int,
        max_count: int,
    ) -> int:
        """Estimate completion percent based on information coverage and progress.

        Heuristic:
        - Determine an expected set of categories based on symptom keywords and dialog so far
        - Measure coverage of those categories from asked questions
        - Blend with raw progress (current_count / max_count)
        """
        try:
            def normalize(text: str) -> str:
                return (text or "").lower().strip()

            def classify(text: str) -> str:
                t = normalize(text)
                if any(k in t for k in ["how long", "since when", "duration"]):
                    return "duration"
                if any(k in t for k in ["trigger", "worse", "aggrav", "what makes", "factors", "reliev"]):
                    return "triggers"
                if any(k in t for k in ["medicat", "treatment", "drug", "remed", "dose", "frequency"]):
                    return "medications"
                if "pain" in t or any(k in t for k in ["scale", "intensity", "sharp", "dull", "burning", "throbbing", "radiat", "location"]):
                    return "pain"
                if any(k in t for k in ["travel", "endemic", "abroad", "sick contact"]):
                    return "travel"
                if any(k in t for k in ["allerg", "hives", "rash", "swelling", "wheeze"]):
                    return "allergies"
                if any(k in t for k in ["past medical", "history of", "surgery", "hospitalization", "chronic", "diabetes", "hypertension", "asthma"]):
                    return "pmh"
                if "family" in t or any(k in t for k in ["mother", "father", "sibling", "hereditary"]):
                    return "family"
                if any(k in t for k in ["smok", "alcohol", "diet", "exercise", "occupation", "work", "exposure"]):
                    return "social"
                return "other"

            # Build expected key set dynamically
            expected: set[str] = {"duration", "triggers", "medications"}
            symptom_t = normalize(disease)
            q_texts = " \n".join(asked_questions or [])
            a_texts = " \n".join(previous_answers or [])
            dialog = normalize(f"{symptom_t} {q_texts} {a_texts}")

            if any(k in dialog for k in ["pain", "ache", "hurt"]):
                expected.add("pain")
            if any(k in dialog for k in ["fever", "cough", "breath", "rash", "diarr", "vomit", "jaundice"]):
                expected.add("travel")
            if any(k in dialog for k in ["allerg", "hives", "wheeze", "swelling"]):
                expected.add("allergies")
            if any(k in dialog for k in ["diabetes", "hypertension", "asthma", "chronic", "surgery", "hospital"]):
                expected.add("pmh")
            if any(k in dialog for k in ["family", "mother", "father", "sibling", "hereditary"]):
                expected.add("family")
            if any(k in dialog for k in ["smok", "alcohol", "diet", "exercise", "occupation", "work", "exposure"]):
                expected.add("social")

            covered = {classify(q) for q in (asked_questions or [])}
            covered_keys = len(covered & expected)
            coverage_ratio = 0.0
            if expected:
                coverage_ratio = covered_keys / len(expected)

            progress_ratio = 0.0
            if max_count > 0:
                progress_ratio = min(max(current_count / max_count, 0.0), 1.0)

            # Weighting: coverage (60%) + progress (40%)
            score = (0.6 * coverage_ratio + 0.4 * progress_ratio) * 100.0
            score = max(0, min(int(round(score)), 100))
            # Ensure a gentle floor after the first answer to avoid 0%
            if current_count > 0 and score < 10:
                score = 10
            return score
        except Exception:
            if max_count <= 0:
                return 0
            return max(0, min(int(round((current_count / max_count) * 100.0)), 100))

    def is_medication_question(self, question: str) -> bool:
        """Detect if a question pertains to medications, enabling image upload."""
        text = (question or "").lower()
        keywords = [
            "medication",
            "medicine",
            "drug",
            "dose",
            "frequency",
            "prescription",
            "remedy",
            "treatment",
        ]
        return any(k in text for k in keywords)

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
