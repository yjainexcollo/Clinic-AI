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
    'soap.walkin_title': 'Walk-in SOAP Summary',
    'soap.walkin_workflow': 'Walk-in Workflow',
    'soap.not_generated': 'SOAP Note Not Generated',
    'soap.generation_details': 'Generation Details',
    'soap.walkin_info': 'Walk-in Workflow Information',
    'soap.current_status': 'Current Workflow Status',
    'soap.current_step': 'Current Step',
    'soap.next_step': 'Next Step',
    'soap.soap_generation': 'SOAP Generation',
    'soap.postvisit_summary': 'Post-Visit Summary',
    'soap.vital_signs': 'Vital Signs',
    'soap.physical_exam': 'Physical Examination',
    'soap.key_highlights': 'Key Highlights',
    'soap.red_flags': 'Red Flags',
    'soap.template_subjective': 'Subjective Template',
    'soap.template_objective': 'Objective Template',
    'soap.template_assessment': 'Assessment Template',
    'soap.template_plan': 'Plan Template',
    'soap.template_name': 'Template Name',
    'soap.template_category': 'Category',
    'soap.template_speciality': 'Speciality',
    'soap.template_description': 'Description (optional)',
    'soap.template_tags': 'Tags (comma-separated)',
    'soap.template_appointment_types': 'Appointment Types (comma-separated)',
    'soap.template_status': 'Status',
    'soap.template_mark_favorite': 'Mark as favorite',
    'soap.back_to_actions': 'Back to Actions',
    'soap.generate_summary': 'Generate SOAP Summary',
    'soap.generating': 'Generating...',
    'soap.status_active': 'Active',
    'soap.status_inactive': 'Inactive',
    'soap.status_draft': 'Draft',
    'soap.generation_settings': 'SOAP Generation Settings',
    'soap.generation_settings_message': 'You can fill this template form to guide the SOAP summary for this visit, or skip it and generate using the default format.',
    'soap.use_custom_template': 'Use custom SOAP template for this generation only',
    'soap.default_structure_note': 'If unchecked, the default SOAP structure is used.',
    'soap.default_structure_note_disabled': 'If disabled, the default AI format is used.',
    'soap.prepare_generation': 'Prepare SOAP Generation',
    'soap.prepare_generation_message': 'Click below to configure (optional) a one-time SOAP template and generate the SOAP summary.',
    'vitals.blood_pressure_key': 'Blood Pressure',
    'vitals.heart_rate_key': 'Heart Rate',
    'vitals.temperature_key': 'Temperature',
    'vitals.spo2_key': 'SpO2',
    'vitals.weight_key': 'Weight',
    'vitals.height_key': 'Height',
    'vitals.respiratory_rate_key': 'Respiratory Rate',
    'exam.general_appearance': 'General Appearance',
    'exam.heent': 'HEENT',
    'exam.cardiac': 'Cardiac',
    'exam.respiratory': 'Respiratory',
    'exam.abdominal': 'Abdominal',
    'exam.neuro': 'Neuro',
    'exam.extremities': 'Extremities',
    'exam.gait': 'Gait',

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
    'soap.walkin_title': 'Resumen SOAP Sin Cita',
    'soap.walkin_workflow': 'Flujo Sin Cita',
    'soap.not_generated': 'Nota SOAP No Generada',
    'soap.generation_details': 'Detalles de Generación',
    'soap.walkin_info': 'Información del Flujo Sin Cita',
    'soap.current_status': 'Estado Actual del Flujo',
    'soap.current_step': 'Paso Actual',
    'soap.next_step': 'Siguiente Paso',
    'soap.soap_generation': 'Generación SOAP',
    'soap.postvisit_summary': 'Resumen Post-Consulta',
    'soap.vital_signs': 'Signos Vitales',
    'soap.physical_exam': 'Examen Físico',
    'soap.key_highlights': 'Aspectos Destacados Clave',
    'soap.red_flags': 'Señales de Alerta',
    'soap.template_subjective': 'Plantilla Subjetiva',
    'soap.template_objective': 'Plantilla Objetiva',
    'soap.template_assessment': 'Plantilla de Evaluación',
    'soap.template_plan': 'Plantilla de Plan',
    'soap.template_name': 'Nombre de la Plantilla',
    'soap.template_category': 'Categoría',
    'soap.template_speciality': 'Especialidad',
    'soap.template_description': 'Descripción (opcional)',
    'soap.template_tags': 'Etiquetas (separadas por comas)',
    'soap.template_appointment_types': 'Tipos de Cita (separados por comas)',
    'soap.template_status': 'Estado',
    'soap.template_mark_favorite': 'Marcar como favorito',
    'soap.back_to_actions': 'Volver a Acciones',
    'soap.generate_summary': 'Generar Resumen SOAP',
    'soap.generating': 'Generando...',
    'soap.status_active': 'Activo',
    'soap.status_inactive': 'Inactivo',
    'soap.status_draft': 'Borrador',
    'soap.generation_settings': 'Configuración de Generación de SOAP',
    'soap.generation_settings_message': 'Puede rellenar este formulario de plantilla para guiar el resumen SOAP de esta visita, o saltarlo y generar usando el formato predeterminado.',
    'soap.use_custom_template': 'Usar plantilla SOAP personalizada solo para esta generación',
    'soap.default_structure_note': 'Si no está marcada, se utiliza la estructura SOAP predeterminada.',
    'soap.default_structure_note_disabled': 'Si está deshabilitada, se utiliza el formato de IA predeterminado.',
    'soap.prepare_generation': 'Preparar Generación de SOAP',
    'soap.prepare_generation_message': 'Haga clic a continuación para configurar (opcionalmente) una plantilla SOAP única y generar el resumen SOAP.',
    'vitals.blood_pressure_key': 'Presión Arterial',
    'vitals.heart_rate_key': 'Frecuencia Cardíaca',
    'vitals.temperature_key': 'Temperatura',
    'vitals.spo2_key': 'SpO2',
    'vitals.weight_key': 'Peso',
    'vitals.height_key': 'Altura',
    'vitals.respiratory_rate_key': 'Frecuencia Respiratoria',
    'exam.general_appearance': 'Apariencia General',
    'exam.heent': 'HEENT',
    'exam.cardiac': 'Cardíaco',
    'exam.respiratory': 'Respiratorio',
    'exam.abdominal': 'Abdominal',
    'exam.neuro': 'Neurológico',
    'exam.extremities': 'Extremidades',
    'exam.gait': 'Marcha',
    
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