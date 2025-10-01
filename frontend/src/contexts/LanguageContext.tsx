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
    console.log('DEBUG: LanguageContext - savedLanguage from localStorage:', savedLanguage);
    // Migrate old "es" values to "sp"
    if (savedLanguage === 'es' as any) {
      console.log('DEBUG: LanguageContext - migrating "es" to "sp"');
      localStorage.setItem('clinicai_language', 'sp');
      return 'sp';
    }
    const finalLanguage = savedLanguage || 'en';
    console.log('DEBUG: LanguageContext - final language:', finalLanguage);
    return finalLanguage;
  });

  useEffect(() => {
    // Save language to localStorage whenever it changes
    console.log('DEBUG: LanguageContext - saving language to localStorage:', language);
    localStorage.setItem('clinicai_language', language);
  }, [language]);

  const handleSetLanguage = (newLanguage: Language) => {
    console.log('DEBUG: LanguageContext - setLanguage called with:', newLanguage);
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