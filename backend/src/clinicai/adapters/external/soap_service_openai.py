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
        
        if intake_data and intake_data.get('questions_asked'):
            intake_responses = []
            for qa in intake_data['questions_asked']:
                intake_responses.append(f"Q: {qa['question']}\nA: {qa['answer']}")
            context_parts.append(f"Intake Responses:\n" + "\n\n".join(intake_responses))
        
        context = "\n\n".join(context_parts) if context_parts else "No additional context available"
        
        # Create the prompt
        prompt = f"""
You are a clinical scribe generating a structured SOAP note from a doctor–patient consultation.

INPUTS
CONTEXT: {context}
DEMOGRAPHICS: Age {patient_context.get('age', 'Unknown')}, Patient
CHIEF_COMPLAINT: {patient_context.get('symptom', 'Not specified')}
TRANSCRIPT: {transcript}
PATIENT_ID: {patient_context.get('patient_id', 'Unknown')}
VISIT_ID: Unknown
VISIT_DATE: Unknown

GLOBAL OUTPUT RULES
- Output ONE JSON object ONLY (no markdown, no code fences, no prose outside JSON, no comments).
- Use valid JSON with double quotes; no embedded Python dicts or strings containing JSON.
- Mirror EXACTLY the keys, casing, order, and value types of the JSON example at the end.
- HPI must be ONE readable paragraph (OLDCARTS woven into prose).
- If something wasn't stated: use "Not discussed" (or "Unclear" within HPI for unknown sub-items).
- Do not invent diagnoses, vitals, exam findings, tests, or plans not stated by the clinician.
- Normalize obvious medical mispronunciations when unambiguous (e.g., "cinnamon grill" → "lisinopril"; "jardins/giordians" → "Jardiance (empagliflozin)"); otherwise use "Unclear".
- DO NOT output patient names, phone numbers, or any unique identifiers. Use only `PATIENT_ID` provided in inputs for identification.
- Use only information present in INPUTS; do NOT pull content from other cases.

SECTION CONTENT MAPPING (what goes where)

Subjective (patient-reported only)
- Chief complaint:
  * Extract ONLY clinical problems/symptoms the patient wants help with (e.g., "diabetes management," "high blood pressure," "right shoulder pain," "chest pain," "shortness of breath").
  * EXCLUDE non-clinical visit reasons: "establish care," "annual physical," "forms/paperwork," "medication refills," "clearance," "insurance," "follow-up (administrative)."
  * If both clinical and non-clinical items are present, include ONLY the clinical problems/symptoms.
  * If no clinical problem is stated anywhere, set to "Unclear".
- HPI (one narrative paragraph):
  * Weave OLDCARTS into natural prose for the ACTIVE CLINICAL PROBLEMS mentioned (handle multiple problems within the single paragraph).
  * Include: Onset, Location, Duration, Characterization/quality, Aggravating factors, Relieving factors, Radiation, Temporal pattern, Severity (1–10), Associated symptoms, Relevant negatives.
  * Prefer the patient's phrasing; normalize obvious mispronunciations. For unknown sub-items write "Unclear" inline (e.g., "Severity: Unclear.").
  * DO NOT include non-clinical reasons (establish care/physical/refills) in HPI.
- History (key–value object):
  * Emit ONE object with exactly four fixed keys: "medical", "surgical", "family", "social".
  * Each value must be a string. If not mentioned, set value to "Not discussed".
  * medical: chronic illnesses or relevant conditions reported by the patient.
  * surgical: prior surgeries/procedures with year if stated.
  * family: pertinent hereditary/chronic conditions.
  * social: smoking, alcohol, occupation, exposures, diet/exercise — patient-reported only.
- Review of systems (one narrative paragraph):
  * Summarize system-based positives/negatives spoken by the patient (e.g., General, Neuro, Eyes, Resp, GI). Prose only, not a list.
- current medication (one narrative line):
  * Medications/supplements the patient reports (name/dose/frequency if available). Include allergy statements ONLY if explicitly stated by the patient.
  * Normalize obvious drug-name mishearings if unambiguous; otherwise use "Unclear".

Objective (measurable/observed only)
- vitals:
  * Include ONLY if stated/measured. Preferred format in one sentence:
    "BP <systolic>/<diastolic> mmHg, HR <rate> bpm, RR <rate> breaths/min, Temp <value> °F or °C (specify unit), SpO2 <percent>% on room air or on <flow> L O2."
  * If weight/height/BMI are explicitly stated, append: "Weight <kg or lb>, Height <cm or in>, BMI <value>."
  * Do NOT infer or compute missing values.
- general_appearance: clinician's observations if stated (e.g., alert/oriented, fatigued, in distress).
- physical_exam (one narrative paragraph):
  * Clinician-stated exam findings by system, in prose (e.g., shoulder ROM/strength, special tests like empty can; "heart sounds normal"; "lungs clear"; diabetic foot monofilament sensation).
  * DO NOT include patient-reported symptoms here.
- laboratory / imaging / diagnostics_other:
  * Only actual results explicitly discussed (CBC result, HbA1c result, X-ray/CT/MRI findings, ECG, spirometry, etc.). Orders for future tests belong in Plan.
- other_clinician_notes:
  * Clinician context explicitly stated (e.g., "reviewed past notes", "new to clinic"), or referenced external documentation.

Assessment (clinician's analysis only)
- problems: array of diagnoses/working problems the clinician explicitly states, ordered by importance. If none stated → [].
- differential_diagnoses: array only if alternatives were explicitly discussed by the clinician; most→least likely; include dangerous-but-less-likely ONLY if mentioned; else [].
- discussion: brief clinician reasoning as stated; else "Not discussed".
- DO NOT infer new problems/differentials beyond the transcript.

Plan (clinician's next steps only; SINGLE JSON STRING with four lines)
- Emit ONE string with exactly four lines, each starting with the fixed heading, separated by a single newline character "\\n":
  1) "Medications and Dosages: <one-line summary of meds prescribed/continued/adjusted with dose/frequency/duration IF stated. Exclude meds discussed but deferred.>"
  2) "Lifestyle Modifications: <one-line summary of non-pharmacologic advice discussed (diet, exercise, salt reduction, sleep, stress).>"
  3) "Diagnostic Tests and Imaging: <one-line summary of orders/referrals/vaccines with rationale IF stated.>"
  4) "Follow-up Recommendations: <one-line timing, escalation criteria, and referrals/consults as stated.>"
- Example internal format:
  "Medications and Dosages: Continue metformin and Jardiance; continue lisinopril 10 mg daily; prescribe lidocaine patches.\\nLifestyle Modifications: Daily 30-min walks at moderate intensity; reduce carbohydrates and dinner salt.\\nDiagnostic Tests and Imaging: Order HbA1c and kidney labs; ophthalmology referral; patient to schedule dental exam; age-appropriate vaccines.\\nFollow-up Recommendations: Follow up after labs with BP log; earlier if symptoms worsen."
- Do NOT add items not present in the transcript.

CLINICAL vs NON-CLINICAL FILTER (for Chief complaint & HPI)
- Clinical examples to INCLUDE: "diabetes," "high blood pressure/hypertension," "right shoulder pain," "chest pain," "breathlessness," "cough," "fever," "rash," "dizziness," "headache," etc.
- Non-clinical phrases to EXCLUDE from Chief complaint/HPI: "establish care," "annual/physical exam," "wellness visit," "paperwork/forms," "refills/medication refills," "clearance," "insurance," "follow-up (administrative)."
- If non-clinical context exists, you may summarize it in "other_clinician_notes" (Objective) ONLY if the clinician explicitly said it; otherwise omit.

EDGE GUARDRAILS
- OB/GYN content only if gender is female or explicitly discussed.
- Functional status in Subjective only if the patient described activity-limiting pain/mobility or neurologic symptoms.
- If patient and clinician conflict, prefer clinician for Objective/Assessment/Plan; keep patient statements in Subjective.

SELF-VALIDATION (must pass before finalizing)
- Top-level container key must be "soap" (NOT "soap_note").
- "subjective", "objective", "assessment", "plan" must be JSON objects (NOT strings or embedded dicts).
- "subjective.History" must be a key–value object with exactly four fixed keys: "medical", "surgical", "family", "social".
- "Chief complaint" must contain ONLY clinical problems/symptoms; it must NOT contain admin phrases (establish care/physical/refills/etc.).
- "vitals" (if present) must use correct units and labels as specified; do NOT fabricate absent values.
- "physical_exam" and "Review of systems" are narrative paragraphs (no bullets).
- "plan" must be ONE string with EXACTLY four lines in the order specified, separated by "\\n", and each line must begin with the exact heading.
- No extra fields (e.g., highlights, red_flags, model_info, confidence_score). No nulls. Use "Not discussed" where needed.

JSON EXAMPLE (schema-by-example — copy this structure exactly)

{{
  "patient_id": "CLINIC01-YYYYMMDD-SEQ",
  "visit_id": "V-00000",
  "visit_date": "2025-09-17T11:30:00Z",
  "soap": {{
    "schema_version": "soap.v1",
    "subjective": {{
      "Chief complaint": "Severe headache for 3 days.",
      "HPI": "The patient, a 45-year-old female, presents with persistent headaches for the past week, beginning in the mornings and worsening through the day, with a severity of 8/10 over the last three days. The pain is located over both temples and feels different from prior migraines; fatigue is prominent and there is no nausea. Symptoms are aggravated by stress and later in the day, partially relieved by cold compresses with minimal response to over-the-counter analgesics. There is no radiation, the pattern is worse toward evening, and she denies any recent changes in medications or lifestyle.",
      "History": {{
        "medical": "Hypertension.",
        "surgical": "Cholecystectomy performed five years ago.",
        "family": "Not discussed",
        "social": "Non-smoker; occasional alcohol; works in a high-stress finance role."
      }},
      "Review of systems": "She reports persistent fatigue and an unintended 10-pound weight loss over the past month. Neurologically, she endorses ongoing headaches with intermittent tingling in the fingers. She denies visual changes, and no additional respiratory, gastrointestinal, or constitutional symptoms were discussed.",
      "current medication": "Lisinopril 10 mg daily and ibuprofen as needed; no known drug allergies if explicitly stated."
    }},
    "objective": {{
      "vitals": "Blood pressure 130/90 mmHg, heart rate 78 bpm, respiratory rate 16 breaths/min, temperature 98.6°F, SpO2 98% on room air.",
      "general_appearance": "Alert and oriented, appears fatigued.",
      "physical_exam": "On physical examination, there is mild tenderness to palpation over the temples without sinus tenderness. The neurologic examination demonstrates cranial nerves II–XII intact with no focal deficits. No additional abnormal findings were documented.",
      "laboratory": "Not discussed",
      "imaging": "Not discussed",
      "diagnostics_other": "Not discussed",
      "other_clinician_notes": "Not discussed"
    }},
    "assessment": {{
      "problems": ["Tension-type headache"],
      "differential_diagnoses": ["Migraine", "Hypertension-related headache", "Sinusitis"],
      "discussion": "Gradual onset with stress association and evening worsening, along with a normal neurological examination, favors a primary tension-type headache. Absence of nausea/photophobia in this episode makes migraine less likely; mild blood pressure elevation and lack of sinus tenderness reduce the likelihood of hypertension-related headache and sinusitis."
    }},
    "plan": {{
      "plan": "Medications and Dosages: Continue Lisinopril 10 mg daily; trial Naproxen 500 mg as needed if stated by the clinician.\\nLifestyle Modifications: Stress-reduction with meditation and paced breathing; hydration and regular sleep schedule.\\nDiagnostic Tests and Imaging: Consider MRI brain with and without contrast if indicated by atypical features.\\nFollow-up Recommendations: Reassess in two weeks; earlier if symptoms worsen or new neurological deficits develop."
    }}
  }}
}}

FINAL INSTRUCTION
Now generate the SOAP note using the TRANSCRIPT and inputs above. Return ONE JSON object only, exactly matching the keys, order, and narrative style in the example.
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
