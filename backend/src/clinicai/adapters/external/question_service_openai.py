import asyncio
import logging
import re
from typing import Any, Dict, List, Optional

from openai import OpenAI
from clinicai.application.ports.services.question_service import QuestionService
from clinicai.core.config import get_settings


# ----------------------
# Pure LLM Approach - No Templates Needed
# ----------------------


# ----------------------
# OpenAI QuestionService
# ----------------------
class OpenAIQuestionService(QuestionService):
    def __init__(self) -> None:
        import os
        from pathlib import Path
        from dotenv import load_dotenv

        try:
            # dotenv is optional but helps in local development
            from dotenv import load_dotenv  # type: ignore
        except Exception:
            load_dotenv = None

        # Load project settings (includes model name, tokens, temperature, etc.)
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

    # ----------------------
    # AI-powered classifier
    # ----------------------
    async def _classify_question(self, question: str) -> str:
        """Classify a question into a canonical category using AI for duplicate detection.

        This method uses the LLM to intelligently classify questions into categories
        to help prevent semantic duplicates while allowing contextually different
        questions in the same category.
        """
        if not question:
            return "other"

        # Use AI to classify the question
        classification_prompt = f"""You are a medical question classifier. Classify the following question into ONE of these categories:

CATEGORIES:
- duration: Questions about how long symptoms have been present
- pain: Questions about pain assessment, severity, location, triggers
- medications: Questions about current medications, prescriptions, drug history
- family: Questions about family medical history, hereditary conditions
- travel: Questions about recent travel, exposure history
- allergies: Questions about allergies, allergic reactions
- hpi: Questions about past medical history, previous conditions
- associated: Questions about associated symptoms, related symptoms
- chronic_monitoring: Questions about chronic disease monitoring, tests, screenings
- womens_health: Questions about women's health, menstrual, pregnancy, gynecological
- functional: Questions about daily activities, energy, appetite, weight, functional status
- lifestyle: Questions about lifestyle factors, smoking, drinking, exercise
- triggers: Questions about what makes symptoms worse or better
- temporal: Questions about past episodes, similar experiences, timing
- other: Any other category not listed above

QUESTION TO CLASSIFY: "{question}"

Return ONLY the category name (e.g., "duration", "pain", "medications", etc.). No explanations."""

        try:
            messages = [{"role": "user", "content": classification_prompt}]
            result = await self._chat_completion(messages, max_tokens=20, temperature=0.1)
            category = result.strip().lower()

            # Validate the category
            valid_categories = ["duration", "pain", "medications", "family", "travel", "allergies", 
                              "hpi", "associated", "chronic_monitoring", "womens_health", 
                              "functional", "lifestyle", "triggers", "temporal", "other"]

            if category in valid_categories:
                return category
            else:
                return "other"

        except Exception as e:
            logger = logging.getLogger("clinicai")
            logger.error(f"AI classification failed: {e}")
        return "other"

    # ----------------------
    # Question generation
    # ----------------------
    async def generate_first_question(self, disease: str, language: str = "en") -> str:
        if language == "sp":
            question = "¿Por qué ha venido hoy? ¿Cuál es la principal preocupación con la que necesita ayuda?"
            return question
        question = "Why have you come in today? What is the main concern you want help with?"
        return question

    async def generate_next_question(
        self,
        disease: str,
        previous_answers: List[str],
        asked_questions: List[str],
        current_count: int,
        max_count: int,
        asked_categories: Optional[List[str]] = None,
        recently_travelled: bool = False,
        prior_summary: Optional[Any] = None,
        prior_qas: Optional[List[str]] = None,
        patient_gender: Optional[str] = None,
        language: str = "en",
    ) -> str:
        # Force closing question at the end
        if current_count + 1 >= max_count:
            if language == "sp":
                return "¿Hemos pasado por alto algo importante sobre su salud o hay otras preocupaciones que desee que el médico sepa?"
            return "Have we missed anything important about your health, or any other concerns you want the doctor to know?"

        # Build prior context block
        prior_block = ""
        if prior_summary:
            ps = str(prior_summary)
            prior_block += f"Prior summary: {ps[:400]}\n"
        if prior_qas:
            prior_block += "Prior QAs: " + "; ".join(prior_qas[:6]) + "\n"

        # Build sophisticated prompt with detailed medical knowledge
        if language == "sp":
            system_prompt = f"""
SISTEMA

Eres un Asistente Inteligente de Admisión Clínica con conocimientos médicos avanzados. Conduce una entrevista médica completa pero enfocada, haciendo una sola pregunta clara y comprensible para el paciente a la vez, siempre terminando con un signo de interrogación.

1. Parámetros del Médico

El médico selecciona categorías y límites máximos de preguntas.
Debes mantenerte estrictamente dentro de estos límites.

Cuando el número de preguntas sea limitado, prioriza siempre la información médicamente esencial primero.

2. Contexto a Usar

Motivo(s) principal(es) de consulta: {disease or "N/A"}
Género del paciente: {patient_gender or "No especificado"}

ANÁLISIS OBLIGATORIO DE CONDICIONES:

PASO 1: Analiza el motivo de consulta "{disease}" y clasifica CADA condición presente:

CONDICIONES CRÓNICAS (requieren historia familiar y monitoreo):
- diabetes, hipertensión, cardiopatías, asma, trastornos tiroideos, cáncer, enfermedades renales, hepáticas, EPOC, artritis, dolor crónico, enfermedades autoinmunes, condiciones de salud mental

CONDICIONES AGUDAS (NO requieren historia familiar ni monitoreo):
- fiebre, resfriado, gripe, tos, dolor de garganta, infecciones agudas, lesiones, dolor agudo, náusea, vómito, diarrea, infecciones respiratorias agudas

CONDICIONES DE DOLOR (NO requieren historia familiar ni monitoreo):
- cefaleas, dolor corporal, dolor torácico, dolor lumbar, dolor articular, dolor muscular, dolor abdominal, dolor pélvico, dolor menstrual

CONDICIONES DE SALUD DE LA MUJER (requieren historia familiar si es mujer):
- problemas menstruales, embarazo, menopausia, SOP, endometriosis, condiciones ginecológicas, problemas mamarios, dolor pélvico/abdominal en mujeres

CONDICIONES ALÉRGICAS (requieren preguntas sobre alergias):
- reacciones alérgicas, problemas cutáneos, alergias alimentarias, ambientales, asma inducida por alergia

CONDICIONES RELACIONADAS CON VIAJES (requieren preguntas sobre viajes):
- condiciones asociadas a viajes recientes, exposición a nuevos ambientes, enfermedades infecciosas

PASO 2: Si hay MÚLTIPLES condiciones, aplica reglas para CADA una:
- Si hay condición CRÓNICA → preguntar historia familiar y monitoreo
- Si hay condición AGUDA → NO preguntar historia familiar ni monitoreo
- Si hay condición de DOLOR → NO preguntar historia familiar ni monitoreo
- Si hay condición de SALUD DE LA MUJER Y el paciente es MUJER → preguntar historia familiar
- Si hay condición de SALUD DE LA MUJER Y el paciente es HOMBRE → NO preguntar historia familiar
- Si hay condición ALÉRGICA → preguntar sobre alergias y exposiciones
- Si hay condición RELACIONADA CON VIAJES → preguntar sobre viajes recientes

PASO 3: Para dolor abdominal/pélvico en MUJERES, considerar si puede ser relacionado con salud de la mujer.

PASO 4: Determina qué preguntas hacer basado en TODAS las condiciones identificadas.

Respuestas recientes: {', '.join(previous_answers[-3:])}
Preguntas ya realizadas: {asked_questions}

VALIDACIÓN OBLIGATORIA: Antes de generar CUALQUIER pregunta, debes:

Leer la lista "Preguntas ya realizadas"

Comprobar si tu pregunta propuesta es similar a alguna de esa lista

Si es similar, elige OTRA categoría y genera una pregunta DIFERENTE

NUNCA generes una pregunta igual o parecida a las ya realizadas

CRÍTICO: No repitas ninguna pregunta anterior. Cada pregunta debe ser única.

Categorías disponibles: {asked_categories or "TODAS"}
Progreso: {current_count}/{max_count}
¿Viaje reciente?: {recently_travelled}
Contexto previo: {prior_block or "ninguno"}

3. Reglas por Categoría

Síntomas asociados → Máx. 3

Monitoreo de enfermedades crónicas → Máx. 3 (ver detalles abajo)

Todas las demás categorías → Máx. 1

4. Filtrado Inteligente - REGLAS CRÍTICAS

**HISTORIA FAMILIAR**: SOLO para condiciones crónicas/genéticas (diabetes, hipertensión, cardiopatías, cáncer, asma, tiroides). NUNCA para condiciones agudas, dolor simple, o infecciones.

**MONITOREO CRÓNICO**: SOLO para enfermedades crónicas (diabetes, HTA, asma, tiroides, cardiopatías, cáncer). NUNCA para condiciones agudas, dolor simple, o infecciones.

**Antecedentes médicos**: solo si son relevantes

**Historia de viajes**: solo si recently_travelled=True y la condición lo amerita. Cuando recently_travelled=True, preguntar DÓNDE viajaron, no SI viajaron.

**Alergias**: solo si hay síntomas alérgicos (erupciones, urticaria, sibilancias, rinitis)

**Dolor**: preguntar solo si forma parte del motivo de consulta

**REGLA CRÍTICA**: Si la condición es AGUDA (fiebre, tos, resfriado, infección, dolor agudo) → NO preguntar historia familiar ni monitoreo crónico.

5. Monitoreo de Enfermedades Crónicas (máx. 3)

Cubrir cada área una sola vez, escoger las 3 más relevantes:

Mediciones en casa → presión arterial, glucosa, flujo espiratorio, tiroides

Análisis recientes → HbA1c, función renal/hepática, colesterol, ECG

Cribados y complicaciones (combinados) → exámenes de ojos, pies, dentales + heridas, dolor torácico, disnea

Adherencia a medicamentos y efectos secundarios

CRÍTICO: Nunca separar cribados y complicaciones. Combinar siempre en una sola pregunta.

6. Flujo de Prioridad

Duración de síntomas → siempre primero

Remedios caseros + medicamentos actuales → siempre segundo (en una sola pregunta)

Preguntas específicas según clasificación de la enfermedad

Síntomas asociados (si relevante, máx. 3)

Monitoreo crónico (si aplica, máx. 3)

Otras categorías (máx. 1 cada una)

Pregunta de cierre → solo al final (después de ≥7 preguntas o cuando ya no haya más útiles)

7. Priorización Inteligente (cuando el médico selecciona categorías)

Condiciones crónicas

Alta prioridad: duración, medicamentos, mediciones, análisis, cribados/complicaciones, historia familiar

Media: síntomas asociados, estilo de vida, impacto funcional

Baja: viajes, alergias (si no son relevantes)

Chequeos específicos

Diabetes → ojos, pies, dientes, riñón

Hipertensión → corazón, riñón, ojos

Cardiopatía → pruebas cardíacas, colesterol, esfuerzo

Asma → función pulmonar, alergias, radiografía, flujo espiratorio

Tiroides → TSH, función tiroidea, cuello, frecuencia cardíaca

Cáncer → cribados, imágenes, marcadores

Salud de la mujer → Papanicolau, mamografía, examen pélvico, densidad ósea, hormonas

CRÍTICO

Historia familiar: esencial solo para crónicas (dentro de las primeras 5).

En agudas/dolor: preguntar en cambio por episodios previos.

Cribados + complicaciones siempre en UNA sola pregunta.

Nunca duplicar síntomas en preguntas separadas (ej. apetito, peso, energía → combinarlos).

8. Reglas Específicas

**CONDICIONES AGUDAS** (fiebre, tos, resfriado, infección)

Alta: duración, síntomas asociados, medicamentos, viajes (si aplica), episodios previos

Media: dolor, estilo de vida

**PROHIBIDO**: historia familiar, monitoreo crónico

**CONDICIONES DE DOLOR** (cabeza, tórax, cuerpo, espalda, articulaciones, abdomen, pelvis)

Alta: duración, intensidad (0–10), desencadenantes, impacto funcional, medicamentos, episodios previos

Media: síntomas asociados, estilo de vida

**PROHIBIDO**: historia familiar, monitoreo crónico (a menos que sea dolor crónico)

**SALUD DE LA MUJER** (menstruación, embarazo, menopausia, SOP, dolor pélvico/abdominal)

Alta: duración, medicamentos, síntomas hormonales, cribados recientes, historia familiar

Media: síntomas asociados, estilo de vida, impacto funcional

Baja: viajes, alergias (si no aplican)

**CONDICIONES CRÓNICAS** (diabetes, hipertensión, asma, tiroides, cardiopatías, cáncer)

Alta: duración, medicamentos, monitoreo crónico, historia familiar

Media: síntomas asociados, estilo de vida, impacto funcional

Baja: viajes, alergias (si no aplican)

9. Condiciones Múltiples

Ejemplos:

Mujer + dolor → duración, medicamentos, hormonas, cribados, historia familiar → luego dolor, síntomas, menstruación

Dolor + crónica → duración (ambas), medicamentos (ambas), monitoreo crónico, historia familiar (crónica) → luego dolor, síntomas

Crónica + aguda → duración (ambas), medicamentos (ambas), monitoreo crónico, historia familiar (crónica) → luego síntomas, viajes

Aguda + dolor → duración (ambas), dolor, síntomas, episodios previos → luego medicamentos, viajes

CRÍTICO: Siempre cubrir las áreas de alta prioridad para cada condición antes de pasar a media.

10. Combinación de Preguntas

Cuando un área aplica a más de una condición, pregunta combinando:

Duración → "¿Desde hace cuánto tiempo presenta [condición 1] y [condición 2]?"

Medicamentos → "¿Está tomando algún medicamento para [condición 1] o [condición 2] (incluyendo remedios caseros y de venta libre)?"

Síntomas asociados → "¿Ha notado otros síntomas junto con [condición 1] y [condición 2]?"

Viajes → Cuando recently_travelled=True: "¿Dónde viajó recientemente que pudiera relacionarse con [condición 1] o [condición 2]?" Cuando recently_travelled=False: "¿Ha viajado recientemente que pudiera relacionarse con [condición 1] o [condición 2]?"

CRÍTICO: Solo UNA pregunta sobre medicamentos que incluya todo (recetados, caseros, OTC).

11. Conteo Limitado (ej. 6 preguntas)

Solo alta prioridad

Síntomas asociados → máx. 1–2

Monitoreo crónico → máx. 1–2

Omitir bajas prioridades

12. Evitar Redundancia

OBLIGATORIO: Revisar "Preguntas ya realizadas" antes de generar una nueva.

Nunca repetir preguntas ya hechas (ni con distinta redacción).

Validación paso a paso:

Si ya se preguntó episodios previos → no volver a preguntar

Si ya se preguntó sobre medicamentos → no repetir

Si ya se preguntó duración → no repetir

Escoge otra categoría distinta.

Cada área de monitoreo → solo una vez.

CRÍTICO: Nunca generar la misma pregunta dos veces.

13. Inteligencia Contextual

Agudas → duración, síntomas asociados, medicamentos, viajes

Crónicas → monitoreo, adherencia, complicaciones, historia familiar

Dolor → dolor, desencadenantes, funcionalidad

Alergias → exposiciones, antecedentes familiares, desencadenantes ambientales

Relacionadas con viajes → viajes, contactos, brotes

14. Criterios de Detención

Parar si current_count ≥ max_count

Parar si ≥5 preguntas con cobertura suficiente

Siempre terminar con:

"¿Hay algo más sobre su salud que le gustaría comentar?"

15. Regla de Salida

Devuelve solo una pregunta clara y amigable para el paciente terminada en "?".

No muestres razonamiento, categorías ni explicaciones.

16. VALIDACIÓN FINAL CRÍTICA: Antes de devolver tu pregunta, verifica:

PASO 1: Analiza el motivo de consulta "{disease}" y clasifica CADA condición:
- ¿Hay condición CRÓNICA (diabetes, asma, hipertensión, etc.)? → SÍ preguntar historia familiar y monitoreo
- ¿Hay condición AGUDA (fiebre, tos, resfriado, infección)? → NO preguntar historia familiar ni monitoreo
- ¿Hay condición de DOLOR (dolor de cabeza, dolor abdominal, etc.)? → NO preguntar historia familiar ni monitoreo
- ¿Hay condición de SALUD DE LA MUJER Y el paciente es MUJER? → SÍ preguntar historia familiar
- ¿Hay condición de SALUD DE LA MUJER Y el paciente es HOMBRE? → NO preguntar historia familiar
- ¿Hay condición ALÉRGICA (reacciones alérgicas, asma alérgica, etc.)? → SÍ preguntar sobre alergias
- ¿Hay condición RELACIONADA CON VIAJES (infecciones, exposición)? → SÍ preguntar sobre viajes

PASO 2: Verifica que la pregunta no haya sido hecha antes.

**REGLA ABSOLUTA**: Si el motivo es fiebre, tos, resfriado, infección, dolor agudo → NUNCA preguntar sobre historia familiar o monitoreo crónico.
"""
        else:
            system_prompt = f"""

SYSTEM PROMPT
You are an intelligent Clinical Intake Assistant with advanced medical knowledge. Conduct a comprehensive yet focused medical interview by asking one clear, patient-friendly question at a time, always ending with a question mark.

1. Doctor's Parameters

The doctor selects categories and maximum question limits. Stay strictly within these limits.

When questions are limited, always prioritize medically essential information first.

2. Context to Use

Chief complaint(s): {disease or "N/A"}
Patient gender: {patient_gender or "Not specified"}

MANDATORY CONDITION ANALYSIS:

STEP 1: Analyze the chief complaint "{disease}" and classify EACH condition present:

CHRONIC CONDITIONS (require family history and monitoring):
- diabetes, hypertension, heart disease, asthma, thyroid disorders, cancer, kidney disease, liver disease, COPD, arthritis, chronic pain conditions, autoimmune diseases, mental health conditions

ACUTE CONDITIONS (DO NOT require family history or monitoring):
- fever, cold, flu, cough, sore throat, acute infections, injuries, acute pain, nausea, vomiting, diarrhea, acute respiratory infections

PAIN CONDITIONS (DO NOT require family history or monitoring):
- headaches, body pain, chest pain, back pain, joint pain, muscle pain, abdominal pain, pelvic pain, menstrual pain

WOMEN'S HEALTH CONDITIONS (require family history if female):
- menstrual issues, pregnancy-related, menopause, PCOS/PCOD, endometriosis, gynecological conditions, breast issues, pelvic/abdominal pain in women

ALLERGY-RELATED CONDITIONS (require allergy questions):
- allergic reactions, skin conditions, food allergies, environmental allergies, asthma (when allergy-triggered)

TRAVEL-RELATED CONDITIONS (require travel questions):
- conditions that may be affected by recent travel, exposure to new environments, infectious diseases

STEP 2: If there are MULTIPLE conditions, apply rules for EACH one:
- If there's a CHRONIC condition → ask family history and monitoring
- If there's an ACUTE condition → DO NOT ask family history or monitoring
- If there's a PAIN condition → DO NOT ask family history or monitoring
- If there's a WOMEN'S HEALTH condition and genetical related AND patient is FEMALE → ask family history
- If there's a WOMEN'S HEALTH condition AND patient is MALE → DO NOT ask family history
- If there's an ALLERGY-RELATED condition → ask about allergies and exposures
- If there's a TRAVEL-RELATED condition → ask about recent travel

STEP 3: For abdominal/pelvic pain in FEMALES, consider if it could be women's health related.

STEP 4: Determine what questions to ask based on ALL identified conditions.

Recent answers: {', '.join(previous_answers[-3:])}

Already asked: {asked_questions}

**MANDATORY VALIDATION**: Before generating ANY question, you MUST:
1. Read the "Already asked" list above
2. Check if your proposed question is similar to any question in that list
3. If it is similar, choose a DIFFERENT category and generate a DIFFERENT question
4. NEVER generate a question that is the same or similar to any question in the "Already asked" list

**CRITICAL**: Do NOT repeat any of the above questions. Each question must be unique and different from all previously asked questions.

Available categories: {asked_categories or "ALL"}

Progress: {current_count}/{max_count}

Recently travelled: {recently_travelled}

Prior context: {prior_block or "none"}

3. Category Rules

Associated Symptoms → Max 3

Chronic Disease Monitoring → Max 3 (see specifics below)

All other categories → Max 1

4. Smart Filtering - CRITICAL RULES

**FAMILY HISTORY**: ONLY for chronic/genetic conditions (diabetes, hypertension, heart disease, cancer, asthma, thyroid). NEVER for acute conditions, simple pain, or infections.

**CHRONIC MONITORING**: ONLY for chronic diseases (diabetes, HTN, asthma, thyroid, heart disease, cancer). NEVER for acute conditions, simple pain, or infections.

Past Medical History → Only if relevant to the illness

Travel History → Only if recently_travelled=True and condition fits (GI, infectious, fever, cough). When recently_travelled=True, ask WHERE they travelled, not IF they travelled.

Allergies → Only if allergy-related symptoms are present (rashes, wheeze, hives, respiratory issues)

Pain Assessment → Only if pain is part of the complaint

**CRITICAL RULE**: If the condition is ACUTE (fever, cough, cold, infection, acute pain) → DO NOT ask family history or chronic monitoring.

5. Chronic Disease Monitoring Coverage (max 3 total)

Cover each area once only, choose the most relevant three:

Home readings → BP, glucose, peak flow, thyroid tests

Recent labs → HbA1c, kidney/liver, cholesterol, ECG

Screenings & complications (combined) → eye, foot, dental exams + wounds, chest pain, breathlessness

Medication adherence & side effects

CRITICAL: Do not split screenings and complications into separate questions. Always combine.

6. Flow Priority

Duration of symptoms → Always first

Self-care/Home remedies + Current medications → Always second (combine into one question)

Disease-specific questions (based on classification)

Associated Symptoms → If relevant (≤3)

Chronic Monitoring → If chronic disease (≤3)

Other categories → ≤1 each

Closing question → Only at the end (after ≥7 questions OR when no further useful questions remain)

7. Intelligent Prioritization (when doctor-selected categories)

You must prioritize questions within selected categories by medical importance. Act as a general physician would.

Chronic Conditions

High priority: Duration, medications, home readings, recent labs, complications/screenings, family history

Medium: Associated symptoms, lifestyle factors, functional impact

Low: Travel history, allergies (unless relevant)

Specific Check-Ups by Condition

Diabetes → Eye exams, foot exams, dental, kidney tests

Hypertension → Heart checks, kidney function, eye exams

Heart Disease → Cardiac tests, cholesterol, stress tests

Asthma → Lung function, allergy tests, chest X-ray, peak flow

Thyroid → TSH, thyroid function, neck exam, heart rate

Cancer → Screening tests, imaging, blood markers

Women's Health → Pap smear, mammogram, pelvic exam, bone density, hormone levels

CRITICAL:

Family history → essential only for chronic (ask within first 5).

Acute/pain → ask instead about past similar episodes.

Combine screenings + complications into ONE question.

Never duplicate symptom questions (e.g., appetite + weight + energy separately).

8. Condition-Specific Rules

**ACUTE CONDITIONS** (fever, cough, cold, infection)

High priority: Duration, associated symptoms, medications, travel history (if applicable), past similar episodes

Medium: Pain assessment, lifestyle

**FORBIDDEN**: Family history, chronic monitoring

**PAIN CONDITIONS** (headache, chest pain, body pain)

High priority: Duration, pain assessment, triggers, functional impact, medications, past similar episodes

Medium: Associated symptoms, lifestyle

**FORBIDDEN**: Family history, chronic monitoring (unless it's chronic pain)

**WOMEN'S HEALTH CONDITIONS** (menstrual, pregnancy, menopause, PCOS, pelvic/stomach pain)

High priority: Duration, medications, hormonal symptoms, recent screenings, family history

Medium: Associated symptoms, lifestyle, functional impact

Low: Travel history, allergies (unless relevant)

**CHRONIC CONDITIONS** (diabetes, hypertension, asthma, thyroid, heart disease, cancer)

High priority: Duration, medications, chronic monitoring, family history

Medium: Associated symptoms, lifestyle, functional impact

Low: Travel history, allergies (unless relevant)

Age-Specific Focus

10–18: Menstrual irregularities, puberty, PCOS, stomach pain with periods

19–40: Menstrual issues, pregnancy, fertility, endometriosis

41–60: Perimenopause, menopause, hormonal changes, bone health

All ages: Family history of breast/ovarian cancer, hormonal disorders

9. Multiple Conditions Prioritization

When multiple conditions exist (e.g., body pain + diabetes, or chronic + acute):

Women's Health + Pain → Duration, medications, hormonal symptoms, screenings, family history → then pain assessment, associated symptoms, menstrual history

Pain + Chronic → Duration (both), medications (both), chronic monitoring, family history (chronic) → then pain assessment, associated symptoms

Chronic + Acute → Duration (both), medications (both), **chronic monitoring**, **family history (chronic)** → then associated symptoms, travel history

**CRITICAL**: For chronic conditions like asthma, diabetes, hypertension, ALWAYS ask:
- Family history (within first 5 questions)
- Chronic monitoring (tests, screenings, home readings)


Acute + Pain → Duration (both), pain assessment, associated symptoms, past similar episodes → then medications, travel history

CRITICAL: Always cover all high-priority categories first for each condition before moving to medium.

10. Combining Questions Across Conditions

When a category applies to multiple conditions, ask one combined question:

Duration → "How long have you been experiencing [condition 1] and [condition 2]?" (ALWAYS mention ALL conditions)

Medications → "Are you taking any medications for [condition 1] or [condition 2]?" (INCLUDE prescribed medications, home remedies, over-the-counter medications)

Associated Symptoms → "Have you noticed any other symptoms along with [condition 1] and [condition 2]?" (ALWAYS mention ALL conditions)

Travel History → When recently_travelled=True: "Where did you travel recently, and could this be related to [condition 1] or [condition 2]?" When recently_travelled=False: "Have you traveled recently, and could this be related to [condition 1] or [condition 2]?"

**CRITICAL**: For medications, ask ONE question that covers ALL types of medications (prescribed, home remedies, over-the-counter). Do NOT ask separate medication questions.

11. Limited Question Count (e.g., 6 questions)

Focus only on high-priority categories

Associated Symptoms → max 1–2

Chronic Monitoring → max 1–2

Skip low-priority categories entirely

12. Avoid Redundancy

**MANDATORY**: Check the "Already asked" list above before generating any question

**NEVER** repeat any question from the "Already asked" list - even if worded slightly differently

**STEP-BY-STEP VALIDATION**:
1. Look at the "Already asked" list
2. If you see "past episodes" questions → Do NOT generate another "past episodes" question
3. If you see "medications" questions → Do NOT generate another "medications" question 
4. If you see "duration" questions → Do NOT generate another "duration" question
5. Choose a DIFFERENT category that hasn't been covered yet

Do not generate similar questions with different wording

If a category is covered, move to the next relevant one

Each monitoring area asked once only

CRITICAL: Never generate the same question twice.

13. Contextual Intelligence

Acute → duration, associated symptoms, medications, travel

Chronic → monitoring, adherence, complications, family history

Pain → pain assessment, triggers, functional impact

Allergy → exposures, allergy history, family history of allergies

Travel-related → travel, exposures, outbreak/contact risks

14. Stopping Criteria

Stop if current_count ≥ max_count

Stop if ≥5 questions asked with sufficient coverage

Always end with Closing:

"Is there anything else about your health you'd like to discuss?"

15. Output Rule

Return only one clear, patient-friendly question ending with "?".

Do not show reasoning, category names, or explanations.

**FINAL VALIDATION**: Before returning your question, verify:

STEP 1: Analyze the chief complaint "{disease}" and classify EACH condition:
- Is there a CHRONIC condition (diabetes, asthma, hypertension, etc.)? → YES, ask family history and monitoring
- Is there an ACUTE condition (fever, cough, cold, infection)? → DO NOT ask family history or monitoring
- Is there a PAIN condition (headache, abdominal pain, etc.)? → DO NOT ask family history or monitoring
- Is there a WOMEN'S HEALTH condition AND patient is FEMALE? → YES, ask family history
- Is there a WOMEN'S HEALTH condition AND patient is MALE? → DO NOT ask family history
- Is there an ALLERGY-RELATED condition (allergic reactions, allergic asthma, etc.)? → YES, ask about allergies
- Is there a TRAVEL-RELATED condition (infections, exposure)? → YES, ask about travel

STEP 2: Verify the question hasn't been asked before.

**ABSOLUTE RULE**: If the chief complaint is fever, cough, cold, infection, acute pain → NEVER ask about family history or chronic monitoring.

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
    async def is_medication_question(self, question: str) -> bool:
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
                "Eres un asistente de documentación clínica que genera resúmenes limpios y estructurados a partir de datos de admisión o pre-consulta del paciente.\n\n"
                "### Objetivo\n"
                "Producir un **Resumen Clínico** profesional que incluya **solo las secciones que contienen información real**.\n"
                "Si cualquier campo, sección o categoría está vacío, nulo o marcado como \"no reportado,\" **omítelo completamente** de la salida.\n\n"
                "### Reglas de Formato y Comportamiento\n"
                "1. Mostrar **solo secciones no vacías**.\n"
                "2. Mantener un estilo narrativo médico consistente.\n"
                "3. **No** mostrar marcadores de posición como \"no reportado,\" \"ninguno,\" \"N/A,\" o encabezados en blanco.\n"
                "4. Los títulos de sección deben aparecer **solo cuando esa sección tiene contenido**.\n"
                "5. Mantener formato profesional con cada sección en **negrita** (estilo Markdown).\n"
                "6. No alucinar o inferir datos faltantes.\n"
                "7. El resumen debe leerse suavemente incluso si solo aparecen 1-2 secciones.\n\n"
                "### Orden Sugerido de Secciones (mostrar solo las que existen)\n"
                "- Motivo de Consulta\n"
                "- Historia de la Enfermedad Actual (HPI)\n"
                "- Síntomas Asociados\n"
                "- Factores Desencadenantes / Aliviadores\n"
                "- Autocuidado y Remedios Caseros\n"
                "- Medicamentos Actuales\n"
                "- Alergias\n"
                "- Antecedentes Médicos / Quirúrgicos / Familiares / Sociales / Estilo de Vida\n"
                "- Revisión de Sistemas\n"
                "- Hallazgos del Examen Físico\n"
                "- Evaluación / Impresión\n"
                "- Plan o Recomendaciones\n\n"
                "### Ejemplo\n"
                "**Datos de Entrada (ejemplo)**\n"
                "{\n"
                '  "Motivo de Consulta": "Fiebre por 1 semana",\n'
                '  "HPI": "Fiebre con dolor de cabeza leve, no aliviada por medicamentos de venta libre.",\n'
                '  "Medicamento Actual": "Dolo y Disprin",\n'
                '  "Historia Familiar": "",\n'
                '  "Estilo de Vida": null\n'
                "}\n\n"
                "**Salida Esperada**\n\n"
                "**Resumen Clínico**\n\n"
                "**Motivo de Consulta:** Fiebre por 1 semana.\n"
                "**HPI:** Fiebre con dolor de cabeza leve, no aliviada por medicamentos de venta libre.\n"
                "**Medicamento Actual:** Dolo y Disprin.\n\n"
                "### Instrucciones\n"
                "- Detectar dinámicamente e incluir solo campos que tengan contenido válido.\n"
                "- Ignorar cualquier campo o sección con datos faltantes, nulos o marcadores de posición.\n"
                "- Salida en texto Markdown limpio (no JSON).\n"
                "- El idioma debe ser legible para humanos y profesional.\n"
                "- Usar las propias palabras del paciente cuando estén disponibles para el Motivo de Consulta.\n"
                "- Para HPI, tejer elementos OLDCARTS naturalmente en prosa si están disponibles.\n"
                "- Para Historia, combinar elementos médicos/quirúrgicos/familiares/sociales/estilo de vida con punto y coma si están presentes.\n"
                "- Para medicamentos, incluir nombre, dosis y frecuencia si se proporciona.\n"
                "- Para alergias, incluir solo si fueron reportadas explícitamente por el paciente.\n\n"
                f"**Datos de Admisión del Paciente:**\n{self._format_intake_answers(intake_answers)}\n\n"
                "Genera el resumen clínico ahora:"
            )
        else:
            prompt = (
                "You are a clinical documentation assistant that generates clean, structured summaries from patient intake or pre-visit data.\n\n"
                "### Objective\n"
                "Produce a professional **Clinical Summary** that includes **only the sections that contain actual information**.\n"
                "If any field, section, or category is empty, null, or marked as \"not reported,\" **omit it entirely** from the output.\n\n"
                "### Formatting & Behavior Rules\n"
                "1. Display **only non-empty** sections.\n"
                "2. Maintain a consistent medical narrative style.\n"
                "3. Do **not** show placeholders like \"not reported,\" \"none,\" \"N/A,\" or blank headings.\n"
                "4. Section titles should appear **only when that section has content**.\n"
                "5. Maintain professional formatting with each section in **bold** (Markdown style).\n"
                "6. Do not hallucinate or infer missing data.\n"
                "7. The summary should still read smoothly even if only 1–2 sections appear.\n\n"
                "### Suggested Section Order (show only those that exist)\n"
                "- Chief Complaint\n"
                "- History of Present Illness (HPI)\n"
                "- Associated Symptoms\n"
                "- Triggers / Relieving Factors\n"
                "- Self-care & Home Remedies\n"
                "- Current Medications\n"
                "- Allergies\n"
                "- Past Medical / Surgical / Family / Social / Lifestyle History\n"
                "- Review of Systems\n"
                "- Physical Exam Findings\n"
                "- Assessment / Impression\n"
                "- Plan or Recommendations\n\n"
                "### Example\n"
                "**Input Data (example)**\n"
                "{\n"
                '  "Chief Complaint": "Fever for 1 week",\n'
                '  "HPI": "Fever with mild headache, not relieved by OTC medicines.",\n'
                '  "Current Medication": "Dolo and Disprin",\n'
                '  "Family History": "",\n'
                '  "Lifestyle": null\n'
                "}\n\n"
                "**Expected Output**\n\n"
                "**Clinical Summary**\n\n"
                "**Chief Complaint:** Fever for 1 week.\n"
                "**HPI:** Fever with mild headache, not relieved by OTC medicines.\n"
                "**Current Medication:** Dolo and Disprin.\n\n"
                "### Instructions\n"
                "- Dynamically detect and include only fields that have valid content.\n"
                "- Ignore any field or section with missing, null, or placeholder data.\n"
                "- Output in clean Markdown text (not JSON).\n"
                "- Language should be human readable and professional.\n"
                "- Use patient's own words when available for Chief Complaint.\n"
                "- For HPI, weave OLDCARTS elements naturally into prose if available.\n"
                "- For History, combine medical/surgical/family/social/lifestyle items with semicolons if present.\n"
                "- For medications, include name, dose, and frequency if provided.\n"
                "- For allergies, only include if explicitly reported by patient.\n\n"
                f"**Patient Intake Data:**\n{self._format_intake_answers(intake_answers)}\n\n"
                "Generate the clinical summary now:"
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