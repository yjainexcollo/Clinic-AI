import asyncio
import logging
from typing import Any, Dict, List, Optional

from openai import OpenAI
from clinicai.application.ports.services.question_service import QuestionService
from clinicai.core.config import get_settings


# ----------------------
# Canonical Categories
# ----------------------
CATEGORIES: List[str] = [
    "Chief Complaint",
    "Symptom Details",
    "Pain Assessment",
    "Associated Symptoms",
    "Self-care & Home Remedies",
    "Current Medications",
    "Allergies",
    "Past Medical & Surgical History",
    "Family History",
    "Lifestyle & Social History",
    "Travel & Exposure History",
    "Women’s Health",
    "Functional Status / Daily Living",
    "Chronic Disease Monitoring",
    "Immunization & Preventive Care",
    "Mental Health / Psychological History",
    "Advance Directives / Special Considerations",
    "Closing / Open-Ended",
]


# ----------------------
# OpenAI QuestionService
# ----------------------
class OpenAIQuestionService(QuestionService):
    def __init__(self) -> None:
        import os
        from pathlib import Path
        try:
            from dotenv import load_dotenv  # type: ignore
        except Exception:
            load_dotenv = None

        self._settings = get_settings()
        self._debug_prompts = getattr(self._settings, "debug_prompts", False)

        api_key = self._settings.openai.api_key or os.getenv("OPENAI_API_KEY", "")
        self._mode = (os.getenv("QUESTION_MODE", "autonomous") or "autonomous").strip().lower()

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
        self, messages: List[Dict[str, str]], max_tokens: int = 128, temperature: float = 0.3
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

    # ----------------------
    # First question
    # ----------------------
    async def generate_first_question(self, disease: str, language: str = "en") -> str:
        if language == "sp":
            return "¿Por qué ha venido hoy? ¿Cuál es la principal preocupación con la que necesita ayuda?"
        return "Why have you come in today? What is the main concern you want help with?"

    # ----------------------
    # Next question (LLM-driven)
    # ----------------------
    async def generate_next_question(
        self,
        disease: str,
        previous_answers: List[str],
        asked_questions: List[str],
        current_count: int,
        max_count: int,
        selected_categories: List[str],
        recently_travelled: bool = False,
        prior_summary: Optional[Any] = None,
        prior_qas: Optional[List[str]] = None,
        language: str = "en",
    ) -> str:

        prior_block = ""
        if prior_summary:
            ps = str(prior_summary)
            prior_block += f"Prior summary: {ps[:400]}\n"
        if prior_qas:
            prior_block += "Prior QAs: " + "; ".join(prior_qas[:6]) + "\n"

        # ----------------------
        # Force closing question at the end
        # ----------------------
        if current_count + 1 >= max_count:
            if language == "sp":
                return "¿Hemos pasado por alto algo importante sobre su salud o hay otras preocupaciones que desee que el médico sepa?"
            return "Have we missed anything important about your health, or any other concerns you want the doctor to know?"

        # ----------------------
        # Build dynamic prompt
        # ----------------------
        if language == "sp":
            system_prompt = f"""
SISTEMA:
Eres un Asistente de Admisión Clínica inteligente con conocimientos médicos avanzados. Tu rol es realizar una entrevista médica completa y enfocada haciendo UNA pregunta relevante a la vez.

SISTEMA DE SELECCIÓN DEL MÉDICO:
El médico ha seleccionado categorías específicas de preguntas y establecido límites máximos de preguntas. Debes trabajar dentro de estas restricciones mientras priorizas preguntas por importancia médica para la enfermedad específica. Cuando el número de preguntas es limitado, enfócate en la información más clínicamente relevante primero.

CONTEXTO:
- Motivo principal de consulta: {disease or "N/A"}
- Respuestas recientes: {', '.join(previous_answers[-3:])}
- Ya preguntado: {asked_questions}
- Categorías disponibles: {selected_categories if selected_categories else "TODAS LAS CATEGORÍAS (priorizar por importancia médica)"}
- Progreso: {current_count}/{max_count}
- Viajó recientemente: {recently_travelled}
- Contexto previo: {prior_block or "ninguno"}

SELECCIÓN INTELIGENTE DE PREGUNTAS:
Debes determinar inteligentemente qué preguntas hacer basándote en el contexto de la enfermedad/síntomas. Usa tu conocimiento médico para identificar:

1. **CLASIFICACIÓN DE ENFERMEDAD**: 
   - Condiciones AGUDAS (fiebre, tos, resfriado, infecciones, lesiones, dolor agudo)
   - Condiciones CRÓNICAS (diabetes, hipertensión, asma, tiroides, enfermedad cardíaca)
   - Condiciones GENÉTICAS/HEREDITARIAS (antecedentes familiares relevantes)
   - Condiciones RELACIONADAS CON ALERGIAS (erupciones, urticaria, síntomas respiratorios)
   - Condiciones RELACIONADAS CON DOLOR (dolores de cabeza, dolor de espalda, dolor articular, etc.)
   - Condiciones RELACIONADAS CON VIAJES (enfermedades infecciosas, síntomas GI)

2. **CATEGORÍAS DE PREGUNTAS Y LÍMITES**:
   - **Autocuidado, Remedios Caseros y Medicamentos Actuales** (COMBINADO): Siempre preguntar una vez
   - **Síntomas Asociados**: Máx 3 preguntas (para detalles de síntomas, síntomas relacionados)
   - **Monitoreo de Enfermedad Crónica**: Máx 3 preguntas (lecturas en casa, laboratorios, exámenes, adherencia a medicamentos, complicaciones)
   - **Todas las demás categorías**: 1 pregunta cada una

3. **FILTRADO INTELIGENTE**:
   - **Antecedentes Familiares**: Solo preguntar para condiciones genéticas/crónicas (diabetes, hipertensión, cáncer, enfermedad cardíaca, etc.)
   - **Antecedentes Médicos**: Solo preguntar para condiciones crónicas o antecedentes agudos relevantes
   - **Monitoreo de Enfermedad Crónica**: Solo preguntar para diabetes, hipertensión, asma, tiroides, enfermedad cardíaca, etc.
   - **Historia de Viajes**: Solo preguntar si viajó_recientemente=True Y la condición está relacionada con viajes (infecciones, síntomas GI)
   - **Alergias**: Solo preguntar si la condición está relacionada con alergias (erupciones, síntomas respiratorios, condiciones de la piel)
   - **Evaluación del Dolor**: Solo preguntar si la condición involucra dolor (dolores de cabeza, dolor de espalda, dolor articular, etc.)

4. **ESPECÍFICOS DEL MONITOREO DE ENFERMEDAD CRÓNICA**:
   Para condiciones crónicas, preguntar sobre estas áreas específicas (preguntar cada área UNA SOLA VEZ):
   - **Lecturas en casa**: Presión arterial, azúcares en sangre, flujo máximo, pruebas de tiroides
   - **Laboratorios recientes**: HbA1c, función renal/hepática, colesterol, ECG
   - **Exámenes y Complicaciones**: Exámenes de ojos/visión, exámenes de pies, exámenes dentales, verificación de heridas, dolor en el pecho, dificultad para respirar
   - **Adherencia a medicamentos y efectos secundarios**: Qué tan bien están tomando los medicamentos y cualquier efecto secundario
   
   IMPORTANTE: NO preguntar por separado sobre "exámenes" y "complicaciones" - combinarlos en UNA pregunta integral por área.

5. **PRIORIDAD DEL FLUJO DE PREGUNTAS**:
   - Duración de síntomas (siempre primero)
   - Autocuidado/Remedios caseros y Medicamentos actuales (combinado, siempre segundo)
   - Preguntas específicas de la enfermedad basadas en clasificación
   - Síntomas asociados (si es relevante, máx 3)
   - Monitoreo crónico (si es condición crónica, máx 3)
   - Otras categorías relevantes (1 cada una)
   - Pregunta de cierre (solo después de mínimo 5 preguntas)

6. **PRIORIZACIÓN INTELIGENTE (cuando las categorías son seleccionadas por el médico)**:
   IMPORTANTE: El médico ha seleccionado categorías específicas y establecido límites de preguntas. Debes priorizar preguntas dentro de esas categorías seleccionadas basándote en la importancia médica para la enfermedad específica. Actúa como un médico general priorizaría la recopilación de información.
   
   **PRIORIDAD DE CONDICIONES CRÓNICAS**:
   - ALTA PRIORIDAD: Duración, medicamentos, lecturas en casa, laboratorios recientes, complicaciones/exámenes, antecedentes familiares
   - PRIORIDAD MEDIA: Síntomas asociados, factores de estilo de vida
   - BAJA PRIORIDAD: Historia de viajes, alergias (a menos que sea relevante)
   
   **EXÁMENES ESPECÍFICOS POR CONDICIÓN**:
   - **Diabetes**: Exámenes de ojos, exámenes de pies, exámenes dentales, pruebas de función renal
   - **Hipertensión**: Exámenes cardíacos, función renal, exámenes de ojos
   - **Enfermedad Cardíaca**: Pruebas cardíacas, niveles de colesterol, pruebas de estrés
   - **Asma**: Pruebas de función pulmonar, pruebas de alergias, radiografías de tórax
   - **Tiroides**: Pruebas de función tiroidea, exámenes del cuello, monitoreo de frecuencia cardíaca
   - **Cáncer**: Pruebas de detección, estudios de imagen, marcadores sanguíneos
   - **Salud de la Mujer**: Papanicolaou, mamografías, exámenes pélvicos, pruebas de densidad ósea, niveles hormonales
   
   CRÍTICO: Los antecedentes familiares son ESENCIALES SOLO para condiciones crónicas (diabetes, hipertensión, enfermedad cardíaca, etc.) - preguntar dentro de las primeras 5 preguntas. Para condiciones agudas y de dolor, preguntar sobre episodios similares pasados en su lugar. Combinar complicaciones/exámenes en UNA pregunta integral.
   
   **Para CONDICIONES AGUDAS (fiebre, tos, resfriado)**:
   - ALTA PRIORIDAD: Duración, síntomas asociados, medicamentos, historia de viajes (si aplica), episodios similares pasados
   - PRIORIDAD MEDIA: Evaluación del dolor, factores de estilo de vida
   - BAJA PRIORIDAD: Antecedentes familiares, monitoreo crónico, alergias (a menos que sea relevante)
   
   CRÍTICO: Para condiciones agudas, preguntar sobre episodios similares pasados (ej., "¿Ha tenido síntomas similares en los últimos meses?"), NO antecedentes familiares de enfermedades crónicas.
   
   **Para CONDICIONES DE DOLOR** (dolor corporal, dolor de pecho, dolores de cabeza, etc.):
   - ALTA PRIORIDAD: Duración, evaluación del dolor, desencadenantes, impacto funcional, medicamentos, episodios similares pasados
   - PRIORIDAD MEDIA: Síntomas asociados, factores de estilo de vida
   - BAJA PRIORIDAD: Antecedentes familiares, monitoreo crónico (a menos que sea dolor crónico)
   
   CRÍTICO: Para TODAS las condiciones de dolor (agudo o crónico), preguntar sobre episodios similares pasados (ej., "¿Ha experimentado episodios de dolor similares recientemente?"), NO antecedentes familiares de enfermedades crónicas como diabetes/hipertensión.
   
   **Para CONDICIONES DE SALUD DE LA MUJER** (problemas menstruales, embarazo, menopausia, SOP, etc.):
   - ALTA PRIORIDAD: Duración, medicamentos, síntomas hormonales, exámenes recientes (Papanicolaou, mamografía), antecedentes familiares
   - PRIORIDAD MEDIA: Síntomas asociados, factores de estilo de vida, impacto funcional
   - BAJA PRIORIDAD: Historia de viajes, alergias (a menos que sea relevante)
   
   CRÍTICO: Para condiciones de salud de la mujer, los antecedentes familiares son ESENCIALES (preguntar dentro de las primeras 5 preguntas). Preguntar sobre exámenes recientes de salud de la mujer y síntomas hormonales.
   
   **CONSIDERACIONES DE SALUD DE LA MUJER POR EDAD**:
   - **Edades 10-18**: Irregularidades menstruales, problemas de pubertad, síntomas de SOP
   - **Edades 19-40**: Problemas menstruales, relacionados con embarazo, fertilidad, SOP, endometriosis
   - **Edades 41-60**: Perimenopausia, menopausia, cambios hormonales, salud ósea
   - **Todas las edades**: Antecedentes familiares de cáncer de mama/ovario, trastornos hormonales
   
   **PRIORIZACIÓN DE MÚLTIPLES CONDICIONES**:
   Cuando un paciente tiene múltiples condiciones (ej., dolor corporal + diabetes, crónica + aguda), prioriza preguntas basadas en la combinación:
   
   **DOLOR + CONDICIONES CRÓNICAS** (ej., dolor corporal + diabetes):
   - ALTA PRIORIDAD: Duración (para ambas condiciones), medicamentos (para ambas condiciones), monitoreo crónico (para condición crónica), antecedentes familiares (para condición crónica)
   - PRIORIDAD MEDIA: Evaluación del dolor, síntomas asociados, impacto funcional
   - BAJA PRIORIDAD: Historia de viajes, alergias (a menos que sea relevante)
   
   **CRÓNICA + CONDICIONES AGUDAS** (ej., diabetes + fiebre):
   - ALTA PRIORIDAD: Duración (para ambas condiciones), medicamentos (para ambas condiciones), monitoreo crónico (para crónica), antecedentes familiares (para crónica)
   - PRIORIDAD MEDIA: Síntomas asociados, historia de viajes (si aplica)
   - BAJA PRIORIDAD: Evaluación del dolor, alergias (a menos que sea relevante)
   
   **AGUDA + CONDICIONES DE DOLOR** (ej., fiebre + dolor de cabeza):
   - ALTA PRIORIDAD: Duración (para ambas condiciones), evaluación del dolor, síntomas asociados, episodios similares pasados
   - PRIORIDAD MEDIA: Medicamentos (para ambas condiciones), historia de viajes (si aplica)
   - BAJA PRIORIDAD: Antecedentes familiares, monitoreo crónico
   
   CRÍTICO: Para múltiples condiciones, asegúrate de que TODAS las categorías de alta prioridad estén cubiertas antes de pasar a prioridad media. No omitas preguntas esenciales para ninguna condición.
   
   **COMBINANDO PREGUNTAS PARA CATEGORÍAS COMPARTIDAS**:
   Cuando una categoría aplica a ambas condiciones, haz UNA pregunta integral cubriendo ambas:
   - **Duración**: "¿Cuánto tiempo ha estado experimentando [condición 1] y [condición 2]?"
   - **Medicamentos**: "¿Está tomando algún medicamento para [condición 1] o [condición 2]?"
   - **Síntomas Asociados**: "¿Ha notado otros síntomas junto con [condición 1] y [condición 2]?"
   - **Historia de Viajes**: "¿Ha viajado recientemente, y esto podría estar relacionado con [condición 1] o [condición 2]?"

   **Cuando el número de preguntas es LIMITADO (ej., 6 preguntas)**:
   - Enfócate SOLO en categorías de ALTA PRIORIDAD
   - Reduce Síntomas Asociados a máx 1-2 preguntas
   - Reduce Monitoreo de Enfermedad Crónica a máx 1-2 preguntas
   - Omite completamente las categorías de BAJA PRIORIDAD

7. **INTELIGENCIA CONTEXTUAL**:
   - Para condiciones CRÓNICAS: Enfocarse en monitoreo, adherencia a medicamentos, complicaciones, antecedentes familiares
   - Para condiciones de DOLOR: Incluir evaluación del dolor, desencadenantes, impacto funcional
   - Para condiciones de ALERGIA: Incluir historia de alergias, desencadenantes ambientales
   - Para condiciones RELACIONADAS CON VIAJES: Incluir historia de viajes, riesgos de exposición

8. **EVITAR REDUNDANCIA**:
   - Nunca repetir preguntas ya realizadas
   - Si una categoría fue cubierta, pasar a la siguiente categoría relevante
   - No hacer preguntas irrelevantes para el tipo de condición
   - NO hacer preguntas similares con diferentes palabras (ej., "complicaciones" vs "exámenes" para la misma condición)
   - Cada área de monitoreo debe preguntarse UNA SOLA VEZ
   - CRÍTICO: Si preguntas sobre "complicaciones" en una pregunta, NO preguntes sobre "exámenes" por separado - es la misma información
   - Para TODAS las condiciones crónicas y genéticas: Preguntar antecedentes familiares temprano (dentro de las primeras 5 preguntas) ya que es esencial para estas condiciones

9. **CRITERIOS DE PARADA**:
   - Parar si current_count ≥ max_count
   - Parar si ≥5 preguntas realizadas y suficiente información recopilada
   - Usar pregunta de cierre: "¿Hay algo más sobre su salud que le gustaría discutir?"

SALIDA:
Devuelve solo UNA pregunta amigable para el paciente terminada en "?". Sin explicaciones, sin nombres de categorías, sin listas.
"""
        else:
            system_prompt = f"""
SYSTEM PROMPT:
You are an intelligent Clinical Intake Assistant with advanced medical knowledge. Your role is to conduct a comprehensive yet focused medical interview by asking ONE relevant question at a time.

DOCTOR SELECTION SYSTEM:
The doctor has selected specific question categories and set maximum question limits. You must work within these constraints while prioritizing questions by medical importance for the specific illness. When question count is limited, focus on the most clinically relevant information first.

CONTEXT:
- Chief complaint(s): {disease or "N/A"}
- Recent answers: {', '.join(previous_answers[-3:])}
- Already asked: {asked_questions}
- Available categories: {selected_categories if selected_categories else "ALL CATEGORIES (prioritize by medical importance)"}
- Progress: {current_count}/{max_count}
- Recently travelled: {recently_travelled}
- Prior context: {prior_block or "none"}

INTELLIGENT QUESTION SELECTION:
You must intelligently determine which questions to ask based on the disease/symptom context. Use your medical knowledge to identify:

1. **DISEASE CLASSIFICATION**: 
   - ACUTE conditions (fever, cough, cold, infections, injuries, acute pain)
   - CHRONIC conditions (diabetes, hypertension, asthma, thyroid, heart disease)
   - GENETIC/HEREDITARY conditions (family history relevant)
   - ALLERGY-RELATED conditions (rashes, hives, respiratory symptoms)
   - PAIN-RELATED conditions (headaches, back pain, joint pain, etc.)
   - TRAVEL-RELATED conditions (infectious diseases, GI symptoms)

2. **QUESTION CATEGORIES & LIMITS**:
   - **Associated Symptoms**: Max 3 questions (for symptom details, related symptoms)
   - **Chronic Disease Monitoring**: Max 3 questions (home readings, labs, screenings, medication adherence, complications)
   - **All other categories**: 1 question each

3. **INTELLIGENT FILTERING**:
   - **Family History**: Only ask for genetic/chronic conditions (diabetes, hypertension, cancer, heart disease, etc.)
   - **Past Medical History**: Only ask for chronic conditions or relevant acute history
   - **Chronic Disease Monitoring**: Only ask for diabetes, hypertension, asthma, thyroid, heart disease, etc.
   - **Travel History**: Only ask if recently_travelled=True AND condition is travel-related (infections, GI symptoms)
   - **Allergies**: Only ask if condition is allergy-related (rashes, respiratory symptoms, skin conditions)
   - **Pain Assessment**: Only ask if condition involves pain (headaches, back pain, joint pain, etc.)

4. **CHRONIC DISEASE MONITORING SPECIFICS**:
   For chronic conditions, ask about these specific areas (ask each area ONCE only):
   - **Home readings**: Blood pressure, blood sugars, peak flow, thyroid tests
   - **Recent labs**: HbA1c, kidney/liver function, cholesterol, ECG
   - **Screenings & Complications**: Eye/vision exams, foot exams, dental exams, wound checks, chest pain, breathlessness
   - **Medication adherence & side effects**: How well they're taking medications and any side effects
   
   IMPORTANT: Do NOT ask separate questions about "screenings" and "complications" - combine them into ONE comprehensive question per area.

5. **QUESTION FLOW PRIORITY**:
   - Duration of symptoms (always first)
   - Self-care/Home remedies & Current medications (combined, always second)
   - Disease-specific questions based on classification
   - Associated symptoms (if relevant, max 3)
   - Chronic monitoring (if chronic condition, max 3)
   - Other relevant categories (1 each)
   - Closing question (only after minimum 7 questions)

6. **INTELLIGENT PRIORITIZATION (when categories are selected by doctor)**:
   IMPORTANT: The doctor has selected specific categories and set question limits. You must prioritize questions within those selected categories based on medical importance for the specific illness. Act as a general physician would prioritize information gathering.
   
   **CHRONIC CONDITIONS PRIORITY**:
   - HIGH PRIORITY: Duration, medications, home readings, recent labs, complications/screenings, family history
   - MEDIUM PRIORITY: Associated symptoms, lifestyle factors, Functional impact
   - LOW PRIORITY: Travel history, allergies (unless relevant)
   
   **SPECIFIC CHECK-UPS BY CONDITION**:
   - **Diabetes**: Eye exams, foot exams, dental check-ups, kidney function tests
   - **Hypertension**: Heart check-ups, kidney function, eye exams
   - **Heart Disease**: Cardiac tests, cholesterol levels, stress tests
   - **Asthma**: Lung function tests, allergy tests, chest X-rays
   - **Thyroid**: Thyroid function tests, neck exams, heart rate monitoring
   - **Cancer**: Screening tests, imaging studies, blood markers
   - **Women's Health**: Pap smears, mammograms, pelvic exams, bone density tests, hormone levels
   
   CRITICAL: Family history is ESSENTIAL ONLY for chronic conditions (diabetes, hypertension, heart disease, etc.) - ask within first 5 questions. For acute conditions and pain conditions, ask about past similar episodes instead. Combine complications/screenings into ONE comprehensive question.
   
   **For ACUTE CONDITIONS (fever, cough, cold)**:
   - HIGH PRIORITY: Duration, associated symptoms, medications, travel history (if applicable), past similar episodes
   - MEDIUM PRIORITY: Pain assessment, lifestyle factors
   - LOW PRIORITY: Family history, allergies (unless relevant), Mental health
   
   CRITICAL: For acute conditions, ask about past similar episodes (e.g., "Have you had similar symptoms in the past few months?"), NOT family history of chronic diseases.
   
   **For PAIN CONDITIONS** (body pain, chest pain, headaches, etc.):
   - HIGH PRIORITY: Duration, pain assessment, triggers, functional impact, medications, past similar episodes
   - MEDIUM PRIORITY: Associated symptoms, lifestyle factors
   - LOW PRIORITY: Travel history, Functional impact
   
   CRITICAL: For ALL pain conditions (acute or chronic), ask about past similar episodes (e.g., "Have you experienced similar pain episodes recently?"), NOT family history of chronic diseases like diabetes/hypertension.
   
   **For WOMEN'S HEALTH CONDITIONS** (menstrual issues, pregnancy, menopause, PCOS, etc.):
   - HIGH PRIORITY: Duration, medications, hormonal symptoms, recent screenings (Pap smear, mammogram), family history
   - MEDIUM PRIORITY: Associated symptoms, lifestyle factors, functional impact
   - LOW PRIORITY: Travel history, allergies (unless relevant)
   
   CRITICAL: For women's health conditions, family history is ESSENTIAL (ask within first 5 questions). Ask about recent women's health screenings and hormonal symptoms.
   
   **AGE-SPECIFIC WOMEN'S HEALTH CONSIDERATIONS**:
   - **Ages 10-18**: Menstrual irregularities, puberty issues, PCOS symptoms
   - **Ages 19-40**: Menstrual issues, pregnancy-related, fertility, PCOS, endometriosis
   - **Ages 41-60**: Perimenopause, menopause, hormonal changes, bone health
   - **All ages**: Family history of breast/ovarian cancer, hormonal disorders
   
   **MULTIPLE CONDITIONS PRIORITIZATION**:
   When a patient has multiple conditions (e.g., body pain + diabetes, chronic + acute), prioritize questions based on the combination:
   
   **PAIN + CHRONIC CONDITIONS** (e.g., body pain + diabetes):
   - HIGH PRIORITY: Duration (for both conditions), medications (for both conditions), chronic monitoring (for chronic condition), family history (for chronic condition)
   - MEDIUM PRIORITY: Pain assessment, associated symptoms, functional impact
   - LOW PRIORITY: Travel history, allergies (unless relevant)
   
   **CHRONIC + ACUTE CONDITIONS** (e.g., diabetes + fever):
   - HIGH PRIORITY: Duration (for both conditions), medications (for both conditions), chronic monitoring (for chronic), family history (for chronic)
   - MEDIUM PRIORITY: Associated symptoms, travel history (if applicable)
   - LOW PRIORITY: Pain assessment, allergies (unless relevant)
   
   **ACUTE + PAIN CONDITIONS** (e.g., fever + headache):
   - HIGH PRIORITY: Duration (for both conditions), pain assessment, associated symptoms, past similar episodes
   - MEDIUM PRIORITY: Medications (for both conditions), travel history (if applicable)
   - LOW PRIORITY: Family history, chronic monitoring
   
   CRITICAL: For multiple conditions, ensure ALL high-priority categories are covered before moving to medium priority. Don't skip essential questions for any condition.
   
   **COMBINING QUESTIONS FOR SHARED CATEGORIES**:
   When a category applies to both conditions, ask ONE comprehensive question covering both:
   - **Duration**: "How long have you been experiencing [condition 1] and [condition 2]?"
   - **Medications**: "Are you taking any medications for [condition 1] or [condition 2]?"
   - **Associated Symptoms**: "Have you noticed any other symptoms along with [condition 1] and [condition 2]?"
   - **Travel History**: "Have you traveled recently, and could this be related to [condition 1] or [condition 2]?"

   **When question count is LIMITED (e.g., 6 questions)**:
   - Focus ONLY on HIGH PRIORITY categories
   - Reduce Associated Symptoms to max 1-2 questions
   - Reduce Chronic Disease Monitoring to max 1-2 questions
   - Skip LOW PRIORITY categories entirely

7. **CONTEXTUAL INTELLIGENCE**:
   - For ACUTE conditions: Focus on duration, associated symptoms, travel (if applicable), medications
   - For CHRONIC conditions: Focus on monitoring, medication adherence, complications, family history
   - For PAIN conditions: Include pain assessment, triggers, functional impact
   - For ALLERGY conditions: Include allergy history, environmental triggers
   - For TRAVEL-RELATED: Include travel history, exposure risks

8. **AVOID REDUNDANCY**:
   - Never repeat questions already asked
   - If a category was covered, move to the next relevant category
   - Don't ask irrelevant questions for the condition type
   - Do NOT ask similar questions with different wording (e.g., "complications" vs "screenings" for the same condition)
   - Each monitoring area should be asked ONCE only
   - CRITICAL: If you ask about "complications" in one question, do NOT ask about "screenings" separately - they are the same information
   - For ALL chronic and genetic conditions: Ask family history early (within first 5 questions) as it's essential for these conditions

9. **STOPPING CRITERIA**:
   - Stop if current_count ≥ max_count
   - Stop if ≥5 questions asked and sufficient information gathered
   - Use closing question: "Is there anything else about your health you'd like to discuss?"

OUTPUT:
Return only ONE patient-friendly question ending with "?". No explanations, no category names, no lists.
"""

        try:
            text = await self._chat_completion(
                messages=[
                    {"role": "system", "content": "You are a clinical intake assistant."},
                    {"role": "user", "content": system_prompt},
                ],
                max_tokens=min(256, self._settings.openai.max_tokens),
                temperature=0.3,
            )
            text = text.replace("\n", " ").strip()
            if not text.endswith("?"):
                text = text.rstrip(".") + "?"
            return text
        except Exception:
            raise

    # ----------------------
    # Stopping logic
    # ----------------------
    async def should_stop_asking(
        self,
        disease: str,
        previous_answers: List[str],
        current_count: int,
        max_count: int,
    ) -> bool:
        if current_count >= max_count:
            return True
        return False

    async def assess_completion_percent(
        self,
        disease: str,
        previous_answers: List[str],
        asked_questions: List[str],
        current_count: int,
        max_count: int,
        prior_summary: Optional[Any] = None,
        prior_qas: Optional[List[str]] = None,
    ) -> int:
        try:
            progress_ratio = 0.0
            if max_count > 0:
                progress_ratio = min(max(current_count / max_count, 0.0), 1.0)
            return int(progress_ratio * 100)
        except Exception:
            if max_count <= 0:
                return 0
            return max(0, min(int(round((current_count / max_count) * 100.0)), 100))
    # ----------------------
    # Medication check
    # ----------------------
    def is_medication_question(self, question: str) -> bool:
        """Return True if the question is about current medications, home remedies, or self-care.
        
        This includes the combined self-care/home remedies/medications questions that have image upload capability.
        """
        question_lower = (question or "").lower()
        
        # Check for combined self-care/home remedies/medications questions
        if ("home remedies" in question_lower and "medications" in question_lower) or \
           ("self-care" in question_lower and "medications" in question_lower) or \
           ("remedies" in question_lower and "supplements" in question_lower) or \
           ("autocuidado" in question_lower and "medicamentos" in question_lower) or \
           ("remedios caseros" in question_lower and "medicamentos" in question_lower):
            return True
            
        # Check for individual medication-related terms
        medication_terms = [
            "medication", "medications", "medicines", "medicine", "drug", "drugs",
            "prescription", "prescribed", "tablet", "tablets", "capsule", "capsules",
            "syrup", "dose", "dosage", "frequency", "supplement", "supplements",
            "insulin", "otc", "over-the-counter", "medicamento", "medicamentos",
            "medicina", "medicinas", "medicamento recetado", "suplemento", "suplementos"
        ]
        
        return any(term in question_lower for term in medication_terms)

    # ----------------------
    # Pre-visit summary
    # ----------------------
    async def generate_pre_visit_summary(
        self,
        patient_data: Dict[str, Any],
        intake_answers: Dict[str, Any],
        language: str = "en",
    ) -> Dict[str, Any]:
        """Generate pre-visit clinical summary from intake data (concise bullets)."""
        
        if language == "sp":
            prompt = (
                "Rol y Tarea\n"
                "Eres un Asistente de Admisión Clínica.\n"
                "Tu tarea es generar un Resumen Pre-Consulta conciso y clínicamente útil (~180-200 palabras) basado estrictamente en las respuestas de admisión proporcionadas.\n\n"
                "Reglas Críticas\n"
                "- No inventes, adivines o expandas más allá de la entrada proporcionada.\n"
                "- La salida debe ser texto plano con encabezados de sección, una sección por línea (sin líneas en blanco adicionales).\n"
                "- Usa solo los encabezados exactos listados a continuación. No agregues, renombres o reordenes encabezados.\n"
                "- Sin viñetas, numeración o formato markdown.\n"
                "- Escribe en un tono de entrega clínica: corto, factual, sin duplicados y neutral.\n"
                "- Incluye una sección solo si contiene contenido; omite secciones sin datos.\n"
                "- No uses marcadores de posición como \"N/A\" o \"No proporcionado\".\n"
                "- Usa frases orientadas al paciente: \"El paciente reporta...\", \"Niega...\", \"En medicamentos:...\".\n"
                "- No incluyas observaciones clínicas, diagnósticos, planes, signos vitales o hallazgos del examen (la pre-consulta es solo lo reportado por el paciente).\n"
                "- Normaliza pronunciaciones médicas obvias a términos correctos sin agregar nueva información.\n\n"
                "Encabezados (usa MAYÚSCULAS EXACTAS; incluye solo si tienes datos)\n"
                "Motivo de Consulta:\n"
                "HPI:\n"
                "Historia:\n"
                "Medicación Actual:\n\n"
                "Pautas de Contenido por Sección\n"
                "- Motivo de Consulta: Una línea en las propias palabras del paciente si está disponible.\n"
                "- HPI: UN párrafo legible tejiendo OLDCARTS en prosa:\n"
                "  Inicio, Localización, Duración, Caracterización/calidad, Factores agravantes, Factores aliviadores, Radiación,\n"
                "  Patrón temporal, Severidad (1-10), Síntomas asociados, Negativos relevantes.\n"
                "  Manténlo natural y coherente (ej., \"El paciente reporta...\"). Si algunos elementos OLDCARTS son desconocidos, simplemente omítelos.\n"
                "- Historia: Una línea combinando cualquier elemento reportado por el paciente usando punto y coma en este orden si está presente:\n"
                "  Médica: ...; Quirúrgica: ...; Familiar: ...; Estilo de vida: ...\n"
                "  (Incluye solo las partes proporcionadas por el paciente; omite las partes ausentes completamente).\n"
                "- Revisión de Sistemas: Una línea narrativa resumiendo positivos/negativos basados en sistemas mencionados explícitamente por el paciente. Mantén como prosa, no como lista.\n"
                "- Medicación Actual: Una línea narrativa con medicamentos/suplementos realmente declarados por el paciente (nombre/dosis/frecuencia si se proporciona). Incluye declaraciones de alergia solo si el paciente las reportó explícitamente.\n\n"
                "Ejemplo de Formato\n"
                "(Estructura y tono solamente—el contenido será diferente; cada sección en una sola línea.)\n"
                "Motivo de Consulta: El paciente reporta dolor de cabeza severo por 3 días.\n"
                "HPI: El paciente describe una semana de dolores de cabeza persistentes que comienzan en la mañana y empeoran durante el día, llegando hasta 8/10 en los últimos 3 días. El dolor es sobre ambas sienes y se siente diferente de migrañas previas; la fatiga es prominente y se niega náusea. Los episodios se agravan por estrés y más tarde en el día, con alivio mínimo de analgésicos de venta libre y algo de alivio usando compresas frías.\n"
                "Historia: Médica: hipertensión; Quirúrgica: colecistectomía hace cinco años; Familiar: no reportada; Estilo de vida: no fumador, alcohol ocasional, trabajo de alto estrés.\n"
                "Medicación Actual: En medicamentos: lisinopril 10 mg diario e ibuprofeno según necesidad; alergias incluidas solo si el paciente las declaró explícitamente.\n\n"
                f"Respuestas de Admisión:\n{self._format_intake_answers(intake_answers)}"
            )
        else:
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
                "- Chief Complaint: One line in the patient's own words if available.\n"
                "- HPI: ONE readable paragraph weaving OLDCARTS into prose:\n"
                "  Onset, Location, Duration, Characterization/quality, Aggravating factors, Relieving factors, Radiation,\n"
                "  Temporal pattern, Severity (1–10), Associated symptoms, Relevant negatives.\n"
                "  Keep it natural and coherent (e.g., \"The patient reports …\"). If some OLDCARTS elements are unknown, simply omit them (do not write placeholders).\n"
                "- History: One line combining any patient-reported items using semicolons in this order if present:\n"
                "  Medical: …; Surgical: …; Family: …; Lifestyle: …\n"
                "  (Include only parts provided by the patient; omit absent parts entirely.)\n"
                "- Review of Systems: One narrative line summarizing system-based positives/negatives explicitly mentioned by the patient (e.g., General, Neuro, Eyes, Resp, GI). Keep as prose, not a list.\n"
                "- Current Medication: One narrative line with meds/supplements actually stated by the patient (name/dose/frequency if provided). Include allergy statements only if the patient explicitly reported them.\n\n"
                "Example Format\n"
                "(Structure and tone only—content will differ; each section on a single line.)\n"
                "Chief Complaint: Patient reports severe headache for 3 days.\n"
                "HPI: The patient describes a week of persistent headaches that begin in the morning and worsen through the day, reaching up to 8/10 over the last 3 days. Pain is over both temples and feels different from prior migraines; fatigue is prominent and nausea is denied. Episodes are aggravated by stress and later in the day, with minimal relief from over-the-counter analgesics and some relief using cold compresses. No radiation is reported, evenings are typically worse, and there have been no recent changes in medications or lifestyle.\n"
                "History: Medical: hypertension; Surgical: cholecystectomy five years ago; Family: not reported; Lifestyle: non-smoker, occasional alcohol, high-stress job.\n"
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
            import re as _re

            text = (response or "").strip()

            # 1) Prefer fenced ```json ... ```
            fence_json = _re.search(r"```json\s*([\s\S]*?)\s*```", text, _re.IGNORECASE)
            if fence_json:
                candidate = fence_json.group(1).strip()
                return json.loads(candidate)

            # 2) Any fenced block without language
            fence_any = _re.search(r"```\s*([\s\S]*?)\s*```", text)
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
                    text2 = line[2:].strip()
                    if current_section == "key_points" and text2:
                        key_findings.append(text2)
                    if current_section == "chief" and text2:
                        chief_bullets.append(text2)
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

