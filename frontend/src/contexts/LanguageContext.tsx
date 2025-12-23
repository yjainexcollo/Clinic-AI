import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Language } from '../components/LanguageToggle';

interface LanguageContextType {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: string, params?: Record<string, string>) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

// Translation keys
const translations = {
  en: {
    // Intake Form
    'intake.title': 'Patient Intake Form',
    'intake.subtitle': 'Please provide your medical information',
    'intake.complete': 'Intake Complete',
    'intake.start': 'Start Intake',
    'intake.next_question': 'Next Question',
    'intake.submit': 'Submit Answer',
    'intake.upload_images': 'Upload Medication Images',
    'intake.clear': 'Clear Images',
    
    // Buttons
    'button.view_previsit': 'View Pre-Visit Summary',
    'button.upload_transcript': 'Upload Transcript',
    'button.view_transcript': 'View Transcript',
    'button.fill_vitals': 'Fill Vitals',
    'button.generate_soap': 'Generate SOAP Summary',
    'button.view_postvisit': 'View Post Visit Summary',
    'button.start_new': 'Start New Intake',
    'button.register_patient': 'Register New Patient',
    
    // Questions
    'question.symptoms': 'What symptoms are you experiencing today?',
    'question.duration': 'How long have you been experiencing these symptoms?',
    'question.severity': 'On a scale of 1-10, how would you rate the severity?',
    'question.medications': 'Are you currently taking any medications?',
    'question.allergies': 'Do you have any known allergies?',
    'question.medical_history': 'Please describe your relevant medical history',
    
    // Summaries
    'summary.previsit': 'Pre-Visit Summary',
    'summary.postvisit': 'Post-Visit Summary',
    'summary.generated': 'Summary Generated',
    'summary.share_whatsapp': 'Share via WhatsApp',
    'summary.print': 'Print Summary',
    
    // Post-Visit Summary Sections
    'postvisit.chief_complaint': 'Chief Complaint',
    'postvisit.key_findings': 'Key Findings',
    'postvisit.diagnosis': 'Diagnosis',
    'postvisit.treatment_plan': 'Treatment Plan',
    'postvisit.medications_prescribed': 'Medications Prescribed',
    'postvisit.medication_name': 'Medication Name',
    'postvisit.dosage': 'Dosage',
    'postvisit.frequency': 'Frequency',
    'postvisit.duration': 'Duration',
    'postvisit.purpose': 'Purpose',
    'postvisit.other_recommendations': 'Other Recommendations',
    'postvisit.investigations_tests': 'Investigations/Tests',
    'postvisit.tests_ordered': 'Tests Ordered',
    'postvisit.purpose_simple': 'Purpose',
    'postvisit.instructions': 'Instructions',
    'postvisit.when_where': 'When/Where',
    'postvisit.warning_signs': 'Warning Signs',
    'postvisit.follow_up': 'Follow-Up',
    'postvisit.next_appointment': 'Next Appointment',
    'postvisit.red_flag_symptoms': 'Red Flag Symptoms',
    'postvisit.patient_instructions': 'Patient Instructions',
    'postvisit.closing_note': 'Closing Note',
    'postvisit.reassurance': 'Reassurance & Encouragement',
    'postvisit.contact_info': 'Contact Information',
    'postvisit.seek_immediate_attention': 'Seek immediate medical attention if you experience:',
    'postvisit.contact': 'Contact',
    'postvisit.visit_date': 'Visit Date',
    'postvisit.doctor_assistant': 'Doctor/Assistant',
    'postvisit.clinic': 'Clinic',
    
    // Appointments
    'appointment.your_appointment': 'Your appointment',
    
    // Vitals Form
    'vitals.title': 'Objective Vitals Form',
    'vitals.patient_visit': 'Patient: {{patientId}} • Visit: {{visitId}}',
    'vitals.generating_soap': 'Generating SOAP summary… it will open automatically when ready.',
    'vitals.already_submitted': 'Vitals already submitted for this visit. You can review them below.',
    'vitals.blood_pressure': 'Blood Pressure',
    'vitals.systolic': 'Systolic (mmHg)',
    'vitals.diastolic': 'Diastolic (mmHg)',
    'vitals.arm_used': 'Arm Used',
    'vitals.position': 'Position',
    'vitals.select_arm': 'Select arm',
    'vitals.left': 'Left',
    'vitals.right': 'Right',
    'vitals.select_position': 'Select position',
    'vitals.sitting': 'Sitting',
    'vitals.standing': 'Standing',
    'vitals.lying': 'Lying',
    'vitals.heart_rate': 'Heart Rate (Pulse)',
    'vitals.bpm': 'Beats per minute (bpm)',
    'vitals.rhythm': 'Rhythm',
    'vitals.select_rhythm': 'Select rhythm',
    'vitals.regular': 'Regular',
    'vitals.irregular': 'Irregular',
    'vitals.respiratory_rate': 'Respiratory Rate',
    'vitals.breaths_per_minute': 'Breaths per minute (optional)',
    'vitals.temperature': 'Temperature',
    'vitals.value': 'Value',
    'vitals.unit': 'Unit',
    'vitals.method': 'Method',
    'vitals.select_method': 'Select method',
    'vitals.oral': 'Oral',
    'vitals.axillary': 'Axillary',
    'vitals.tympanic': 'Tympanic',
    'vitals.rectal': 'Rectal',
    'vitals.oxygen_saturation': 'Oxygen Saturation (SpO₂)',
    'vitals.percent_value': '% value',
    'vitals.height_weight': 'Height & Weight',
    'vitals.height': 'Height (optional)',
    'vitals.weight': 'Weight',
    'vitals.calculated_bmi': 'Calculated BMI:',
    'vitals.pain_score': 'Pain Score (Optional)',
    'vitals.numeric_scale': 'Numeric scale (0-10)',
    'vitals.pain_scale': '0 = No pain, 10 = Worst possible pain',
    'vitals.additional_notes': 'Additional Notes',
    'vitals.notes_placeholder': 'Any additional observations or notes...',
    'vitals.preview': 'Vitals Preview (for SOAP Note)',
    'vitals.preview_placeholder': 'Fill in the required fields to see preview...',
    'vitals.cancel': 'Cancel',
    'vitals.save': 'Save Vitals',
    'vitals.saving': 'Saving...',
    'vitals.already_submitted_btn': 'Already Submitted',

    // SOAP Summary
    'soap.title': 'SOAP Summary',
    'soap.patient_visit': 'Patient: {{patientId}} · Visit: {{visitId}}',
    'soap.generated': 'Generated',
    'soap.back_to_main': 'Back to Main Page',
    'soap.subjective': 'Subjective',
    'soap.objective': 'Objective',
    'soap.assessment': 'Assessment',
    'soap.plan': 'Plan',
    'soap.loading': 'Loading SOAP summary…',
    'soap.no_data': 'No data.',
    'soap.not_discussed': 'Not discussed',
    'soap.vital_signs': 'Vital Signs',
    'soap.physical_examination': 'Physical Examination',
    'soap.key_highlights': 'Key Highlights',
    'soap.red_flags': 'Red Flags',
    'soap.generation_details': 'Generation Details',
    'soap.model': 'Model',
    'soap.confidence': 'Confidence',
    'soap.no_subjective': 'No subjective information available.',
    'soap.no_objective': 'No objective information available.',
    'soap.no_assessment': 'No assessment available.',
    'soap.no_plan': 'No plan available.',
    'soap.walkin_title': 'Walk-in SOAP Summary',
    'soap.walkin_workflow_info': 'Walk-in Workflow Information',
    'soap.walkin_workflow_desc': 'The SOAP note is generated based on the patient\'s transcription and vitals data. After reviewing the SOAP note, you\'ll proceed to create the post-visit summary for the patient.',
    'soap.not_generated': 'SOAP Note Not Generated',
    'soap.generate_button': 'Generate SOAP Summary',
    'soap.generating': 'Generating...',
    'soap.current_step': 'Current Step',
    'soap.next_step': 'Next Step',
    'soap.soap_generation': 'SOAP Generation',
    'soap.post_visit_summary': 'Post-Visit Summary',

    // Physical Exam Labels
    'physical.general_appearance': 'General Appearance',
    'physical.heent': 'HEENT',
    'physical.cardiac': 'Cardiac',
    'physical.respiratory': 'Respiratory',
    'physical.abdominal': 'Abdominal',
    'physical.neuro': 'Neuro',
    'physical.extremities': 'Extremities',
    'physical.gait': 'Gait',

    // Pre-Visit Summary
    'previsit.title': 'Pre-Visit Summary',
    'previsit.subtitle': 'Clinical summary prepared for the doctor',
    'previsit.back_home': 'Back to Home',
    'previsit.clinical_summary': 'Clinical Summary',
    'previsit.red_flags': 'Red Flags',
    'previsit.medication_images': 'Medication Images',
    'previsit.no_summary': 'No summary available. Generating...',
    'previsit.generating_summary': 'Generating summary...',
    'previsit.continue_vitals': 'Continue to Vitals Form',
    'previsit.heading.chief_complaint': 'Chief Complaint',
    'previsit.heading.hpi': 'HPI',
    'previsit.heading.history': 'History',
    'previsit.heading.current_medication': 'Current Medication',
    'previsit.heading.plan': 'Plan',

    // Common
    'common.loading': 'Loading...',
    'common.error': 'Error',
    'common.success': 'Success',
    'common.cancel': 'Cancel',
    'common.confirm': 'Confirm',
    'common.back': 'Back',
    'common.next': 'Next',
    'common.previous': 'Previous',
  },
  sp: {
    // Intake Form
    'intake.title': 'Formulario de Admisión del Paciente',
    'intake.subtitle': 'Por favor proporcione su información médica',
    'intake.complete': 'Admisión Completa',
    'intake.start': 'Iniciar Admisión',
    'intake.next_question': 'Siguiente Pregunta',
    'intake.submit': 'Enviar Respuesta',
    'intake.upload_images': 'Subir Imágenes de Medicamentos',
    'intake.clear': 'Limpiar Imágenes',
    
    // Buttons
    'button.view_previsit': 'Ver Resumen Pre-Consulta',
    'button.upload_transcript': 'Subir Transcripción',
    'button.view_transcript': 'Ver Transcripción',
    'button.fill_vitals': 'Completar Signos Vitales',
    'button.generate_soap': 'Generar Resumen SOAP',
    'button.view_postvisit': 'Ver Resumen Post-Consulta',
    'button.start_new': 'Iniciar Nueva Admisión',
    'button.register_patient': 'Registrar Nuevo Paciente',
    
    // Questions
    'question.symptoms': '¿Qué síntomas está experimentando hoy?',
    'question.duration': '¿Cuánto tiempo ha estado experimentando estos síntomas?',
    'question.severity': 'En una escala del 1 al 10, ¿cómo calificaría la gravedad?',
    'question.medications': '¿Está tomando actualmente algún medicamento?',
    'question.allergies': '¿Tiene alguna alergia conocida?',
    'question.medical_history': 'Por favor describa su historial médico relevante',
    
    // Summaries
    'summary.previsit': 'Resumen Pre-Consulta',
    'summary.postvisit': 'Resumen Post-Consulta',
    'summary.generated': 'Resumen Generado',
    'summary.share_whatsapp': 'Compartir por WhatsApp',
    'summary.print': 'Imprimir Resumen',
    
    // Post-Visit Summary Sections
    'postvisit.chief_complaint': 'Motivo de Consulta',
    'postvisit.key_findings': 'Hallazgos Clave',
    'postvisit.diagnosis': 'Diagnóstico',
    'postvisit.treatment_plan': 'Plan de Tratamiento',
    'postvisit.medications_prescribed': 'Medicamentos Recetados',
    'postvisit.medication_name': 'Nombre del Medicamento',
    'postvisit.dosage': 'Dosis',
    'postvisit.frequency': 'Frecuencia',
    'postvisit.duration': 'Duración',
    'postvisit.purpose': 'Propósito',
    'postvisit.other_recommendations': 'Otras Recomendaciones',
    'postvisit.investigations_tests': 'Investigaciones/Pruebas',
    'postvisit.tests_ordered': 'Pruebas Ordenadas',
    'postvisit.purpose_simple': 'Propósito',
    'postvisit.instructions': 'Instrucciones',
    'postvisit.when_where': 'Cuándo/Dónde',
    'postvisit.warning_signs': 'Signos de Advertencia',
    'postvisit.follow_up': 'Seguimiento',
    'postvisit.next_appointment': 'Próxima Cita',
    'postvisit.red_flag_symptoms': 'Síntomas de Alerta',
    'postvisit.patient_instructions': 'Instrucciones para el Paciente',
    'postvisit.closing_note': 'Nota Final',
    'postvisit.reassurance': 'Tranquilidad y Aliento',
    'postvisit.contact_info': 'Información de Contacto',
    'postvisit.seek_immediate_attention': 'Busque atención médica inmediata si experimenta:',
    'postvisit.contact': 'Contacto',
    'postvisit.visit_date': 'Fecha de Visita',
    'postvisit.doctor_assistant': 'Doctor/Asistente',
    'postvisit.clinic': 'Clínica',
    'postvisit.title': 'Resumen Post-Consulta',
    'postvisit.visit_overview': 'Resumen de la Visita',
    'postvisit.date': 'Fecha',
    'postvisit.patient': 'Paciente',
    'postvisit.visit_type': 'Tipo de Visita',
    'postvisit.walkin_consultation': 'Consulta Sin Cita',
    'postvisit.medications': 'Medicamentos',
    'postvisit.recommendations': 'Recomendaciones',
    'postvisit.next_appointment_title': 'Próxima Cita',
    'postvisit.patient_instructions_title': 'Instrucciones para el Paciente',
    'postvisit.reassurance_note': 'Nota de Tranquilidad',
    'postvisit.contact_information': 'Información de Contacto',
    'postvisit.contact_clinic': 'Si tiene alguna pregunta o inquietud, por favor contacte nuestra clínica:',
    'postvisit.phone': 'Teléfono',
    'postvisit.hours': 'Horario',
    'postvisit.emergency': 'Emergencia',
    'postvisit.emergency_text': 'Llame al 911 para emergencias médicas',
    'postvisit.walkin_title': 'Resumen Post-Consulta de Paciente Sin Cita',
    'postvisit.walkin_workflow_complete': 'Flujo de Paciente Sin Cita Completado',
    'postvisit.walkin_workflow_desc': 'Este es el paso final del flujo de paciente sin cita. El resumen post-consulta proporciona una descripción amigable para el paciente de su consulta, plan de tratamiento e instrucciones de seguimiento.',
    'postvisit.not_generated': 'Resumen Post-Consulta No Generado',
    'postvisit.generate_button': 'Generar Resumen Post-Consulta',
    'postvisit.generating': 'Generando...',
    'postvisit.current_step': 'Paso Actual',
    'postvisit.status': 'Estado',
    'postvisit.final_step': 'Paso final - Listo para completar la visita',
    
    // Appointments
    'appointment.your_appointment': 'Su cita',
    
    // Vitals Form
    'vitals.title': 'Formulario de Signos Vitales Objetivos',
    'vitals.patient_visit': 'Paciente: {{patientId}} • Visita: {{visitId}}',
    'vitals.generating_soap': 'Generando resumen SOAP… se abrirá automáticamente cuando esté listo.',
    'vitals.already_submitted': 'Los signos vitales ya fueron enviados para esta visita. Puede revisarlos a continuación.',
    'vitals.blood_pressure': 'Presión Arterial',
    'vitals.systolic': 'Sistólica (mmHg)',
    'vitals.diastolic': 'Diastólica (mmHg)',
    'vitals.arm_used': 'Brazo Utilizado',
    'vitals.position': 'Posición',
    'vitals.select_arm': 'Seleccionar brazo',
    'vitals.left': 'Izquierdo',
    'vitals.right': 'Derecho',
    'vitals.select_position': 'Seleccionar posición',
    'vitals.sitting': 'Sentado',
    'vitals.standing': 'De pie',
    'vitals.lying': 'Acostado',
    'vitals.heart_rate': 'Frecuencia Cardíaca (Pulso)',
    'vitals.bpm': 'Latidos por minuto (lpm)',
    'vitals.rhythm': 'Ritmo',
    'vitals.select_rhythm': 'Seleccionar ritmo',
    'vitals.regular': 'Regular',
    'vitals.irregular': 'Irregular',
    'vitals.respiratory_rate': 'Frecuencia Respiratoria',
    'vitals.breaths_per_minute': 'Respiraciones por minuto (opcional)',
    'vitals.temperature': 'Temperatura',
    'vitals.value': 'Valor',
    'vitals.unit': 'Unidad',
    'vitals.method': 'Método',
    'vitals.select_method': 'Seleccionar método',
    'vitals.oral': 'Oral',
    'vitals.axillary': 'Axilar',
    'vitals.tympanic': 'Timpánico',
    'vitals.rectal': 'Rectal',
    'vitals.oxygen_saturation': 'Saturación de Oxígeno (SpO₂)',
    'vitals.percent_value': 'valor %',
    'vitals.height_weight': 'Altura y Peso',
    'vitals.height': 'Altura (opcional)',
    'vitals.weight': 'Peso',
    'vitals.calculated_bmi': 'IMC Calculado:',
    'vitals.pain_score': 'Escala de Dolor (Opcional)',
    'vitals.numeric_scale': 'Escala numérica (0-10)',
    'vitals.pain_scale': '0 = Sin dolor, 10 = Dolor insoportable',
    'vitals.additional_notes': 'Notas Adicionales',
    'vitals.notes_placeholder': 'Cualquier observación o nota adicional...',
    'vitals.preview': 'Vista Previa de Signos Vitales (para Nota SOAP)',
    'vitals.preview_placeholder': 'Complete los campos requeridos para ver la vista previa...',
    'vitals.cancel': 'Cancelar',
    'vitals.save': 'Guardar Signos Vitales',
    'vitals.saving': 'Guardando...',
    'vitals.already_submitted_btn': 'Ya Enviado',

    // SOAP Summary
    'soap.title': 'Resumen SOAP',
    'soap.patient_visit': 'Paciente: {{patientId}} · Visita: {{visitId}}',
    'soap.generated': 'Generado',
    'soap.back_to_main': 'Volver a la Página Principal',
    'soap.subjective': 'Subjetivo',
    'soap.objective': 'Objetivo',
    'soap.assessment': 'Evaluación',
    'soap.plan': 'Plan',
    'soap.loading': 'Cargando resumen SOAP…',
    'soap.no_data': 'Sin datos.',
    'soap.not_discussed': 'No discutido',
    'soap.vital_signs': 'Signos Vitales',
    'soap.physical_examination': 'Examen Físico',
    'soap.key_highlights': 'Puntos Clave',
    'soap.red_flags': 'Señales de Alerta',
    'soap.generation_details': 'Detalles de Generación',
    'soap.model': 'Modelo',
    'soap.confidence': 'Confianza',
    'soap.no_subjective': 'No hay información subjetiva disponible.',
    'soap.no_objective': 'No hay información objetiva disponible.',
    'soap.no_assessment': 'No hay evaluación disponible.',
    'soap.no_plan': 'No hay plan disponible.',
    'soap.walkin_title': 'Resumen SOAP de Paciente Sin Cita',
    'soap.walkin_workflow_info': 'Información del Flujo de Paciente Sin Cita',
    'soap.walkin_workflow_desc': 'La nota SOAP se genera basándose en la transcripción y los signos vitales del paciente. Después de revisar la nota SOAP, procederá a crear el resumen post-consulta para el paciente.',
    'soap.not_generated': 'Nota SOAP No Generada',
    'soap.generate_button': 'Generar Resumen SOAP',
    'soap.generating': 'Generando...',
    'soap.current_step': 'Paso Actual',
    'soap.next_step': 'Siguiente Paso',
    'soap.soap_generation': 'Generación SOAP',
    'soap.post_visit_summary': 'Resumen Post-Consulta',

    // Physical Exam Labels
    'physical.general_appearance': 'Apariencia General',
    'physical.heent': 'HEENT',
    'physical.cardiac': 'Cardíaco',
    'physical.respiratory': 'Respiratorio',
    'physical.abdominal': 'Abdominal',
    'physical.neuro': 'Neurológico',
    'physical.extremities': 'Extremidades',
    'physical.gait': 'Marcha',

    // Pre-Visit Summary
    'previsit.title': 'Resumen Preconsulta',
    'previsit.subtitle': 'Resumen clínico preparado para el médico',
    'previsit.back_home': 'Volver al inicio',
    'previsit.clinical_summary': 'Resumen Clínico',
    'previsit.red_flags': 'Signos de Alerta',
    'previsit.medication_images': 'Imágenes de Medicamentos',
    'previsit.no_summary': 'No hay resumen disponible. Generando...',
    'previsit.generating_summary': 'Generando resumen...',
    'previsit.continue_vitals': 'Continuar a Signos Vitales',
    'previsit.heading.chief_complaint': 'Motivo de Consulta',
    'previsit.heading.hpi': 'Historia de la Enfermedad (HPI)',
    'previsit.heading.history': 'Antecedentes',
    'previsit.heading.current_medication': 'Medicamentos Actuales',
    'previsit.heading.plan': 'Plan',

    // Common
    'common.loading': 'Cargando...',
    'common.error': 'Error',
    'common.success': 'Éxito',
    'common.cancel': 'Cancelar',
    'common.confirm': 'Confirmar',
    'common.back': 'Atrás',
    'common.next': 'Siguiente',
    'common.previous': 'Anterior',
  }
};

interface LanguageProviderProps {
  children: ReactNode;
}

export const LanguageProvider: React.FC<LanguageProviderProps> = ({ children }) => {
  const [language, setLanguage] = useState<Language>(() => {
    // Get language from localStorage or default to English
    const savedLanguage = localStorage.getItem('clinicai_language') as Language;
    // Migrate old "es" values to "sp"
    if (savedLanguage === 'es' as any) {
      localStorage.setItem('clinicai_language', 'sp');
      return 'sp';
    }
    const finalLanguage = savedLanguage || 'en';
    return finalLanguage;
  });

  useEffect(() => {
    // Save language to localStorage whenever it changes
    localStorage.setItem('clinicai_language', language);
  }, [language]);

  const handleSetLanguage = (newLanguage: Language) => {
    setLanguage(newLanguage);
  };

  const t = (key: string, params?: Record<string, string>): string => {
    let translation = translations[language][key as keyof typeof translations[typeof language]] || key;
    
    // Replace parameters in translation
    if (params) {
      Object.entries(params).forEach(([paramKey, value]) => {
        translation = translation.replace(`{{${paramKey}}}`, value);
      });
    }
    
    return translation;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage: handleSetLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    // Return default values instead of throwing error to prevent crashes
    console.warn('useLanguage called outside LanguageProvider, using default values');
    return {
      language: 'en' as Language,
      setLanguage: () => {},
      t: (key: string) => key
    };
  }
  return context;
};