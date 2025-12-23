import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { BACKEND_BASE_URL, authorizedFetch } from "../services/patientService";
import { workflowService } from "../services/workflowService";
import { useLanguage } from "../contexts/LanguageContext";

const WalkInPostVisit: React.FC = () => {
  const { patientId = "", visitId = "" } = useParams();
  const navigate = useNavigate();
  const { language, setLanguage, t } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [summaryData, setSummaryData] = useState<any>(null);
  const [workflowInfo, setWorkflowInfo] = useState<any>(null);

  // Sync language from localStorage if available (set during patient registration)
  useEffect(() => {
    if (patientId) {
      const savedLanguage = localStorage.getItem(`language_${patientId}`) as 'en' | 'sp' | null;
      if (savedLanguage && savedLanguage !== language) {
        // Update language context to match patient's preference
        setLanguage(savedLanguage);
      }
    }
  }, [patientId, language, setLanguage]);

  // Fetch post-visit summary and workflow information
  useEffect(() => {
    const fetchData = async () => {
      if (!patientId || !visitId) return;
      
      setLoading(true);
      try {
        // Fetch post-visit summary (correct endpoint path)
        const summaryResponse = await authorizedFetch(`${BACKEND_BASE_URL}/patients/${encodeURIComponent(patientId)}/visits/${encodeURIComponent(visitId)}/summary/postvisit`, {
          headers: { Accept: "application/json" },
        });

        if (summaryResponse.ok) {
          const response = await summaryResponse.json();
          // Extract data from ApiResponse wrapper (backend returns {success, data, message})
          const summary = response.data || response;
          setSummaryData(summary);
        } else if (summaryResponse.status === 404) {
          // Summary not generated yet, that's okay
          setSummaryData(null);
        } else {
          throw new Error(`Failed to fetch post-visit summary: ${summaryResponse.status}`);
        }

        // Fetch workflow information
        const stepsResponse = await workflowService.getAvailableSteps(visitId);
        setWorkflowInfo(stepsResponse);

      } catch (err) {
        console.error("Error fetching data:", err);
        setError(err instanceof Error ? err.message : "Failed to load data");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [patientId, visitId]);

  const generateSummary = async () => {
    setLoading(true);
    setError("");
    
    try {
      const response = await authorizedFetch(`${BACKEND_BASE_URL}/patients/summary/postvisit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          patient_id: patientId,
          visit_id: visitId
        })
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Failed to generate post-visit summary: ${response.status} - ${errorData}`);
      }

      const responseData = await response.json();
      // Extract data from ApiResponse wrapper (backend returns {success, data, message})
      const summary = responseData.data || responseData;
      setSummaryData(summary);

      // Refresh workflow steps after generating summary
      try {
        const stepsResponse = await workflowService.getAvailableSteps(visitId);
        setWorkflowInfo(stepsResponse);
      } catch (error) {
        console.error("Error refreshing workflow steps:", error);
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate post-visit summary");
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    // Navigate back to the main workflow page (intake page with all buttons)
    navigate(`/intake/${encodeURIComponent(patientId)}?v=${encodeURIComponent(visitId)}&walkin=true`);
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('postvisit.walkin_title')}</h1>
          <p className="text-sm text-gray-600 mt-1">
            {t('postvisit.patient')}: {patientId} • {language === 'sp' ? 'Visita' : 'Visit'}: {visitId}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            {language === 'sp' ? 'Flujo Sin Cita' : 'Walk-in Workflow'}
          </span>
          <button
            onClick={handleBack}
            className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
          >
            {t('common.back')}
          </button>
        </div>
      </div>

      {/* Workflow Status */}
      {workflowInfo && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
          <h3 className="text-sm font-medium text-green-800 mb-2">{language === 'sp' ? 'Estado Actual del Flujo' : 'Current Workflow Status'}</h3>
          <p className="text-sm text-green-700">
            <strong>{t('postvisit.current_step')}:</strong> {t('postvisit.title')}
          </p>
          <p className="text-sm text-green-700">
            <strong>{t('postvisit.status')}:</strong> {t('postvisit.final_step')}
          </p>
        </div>
      )}


      {/* Error Message */}
      {error && (
        <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* Summary Content */}
      <div className="bg-white rounded-lg border border-gray-200">
        {!summaryData ? (
          <div className="p-8 text-center">
            <div className="mb-4">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">{t('postvisit.not_generated')}</h3>
              <p className="text-gray-600 mb-6">
                {language === 'sp' 
                  ? 'Genere un resumen amigable para el paciente basado en la consulta, los signos vitales y la nota SOAP.'
                  : 'Generate a patient-friendly summary based on the consultation, vitals, and SOAP note.'}
              </p>
              <button
                onClick={generateSummary}
                disabled={loading}
                className="px-6 py-3 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? t('postvisit.generating') : t('postvisit.generate_button')}
              </button>
            </div>
          </div>
        ) : (
          <div className="p-6">
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-gray-900">{t('postvisit.title')}</h2>
            </div>

            {/* Summary Sections */}
            <div className="space-y-6">
              {/* Visit Overview */}
              <div className="bg-blue-50 p-4 rounded-lg">
                <h3 className="text-lg font-medium text-blue-900 mb-2">{t('postvisit.visit_overview')}</h3>
                <div className="text-blue-800">
                  <p><strong>{t('postvisit.date')}:</strong> {new Date().toLocaleDateString()}</p>
                  <p><strong>{t('postvisit.patient')}:</strong> {patientId}</p>
                  <p><strong>{t('postvisit.visit_type')}:</strong> {t('postvisit.walkin_consultation')}</p>
                </div>
              </div>

              {/* Chief Complaint */}
              {summaryData.chief_complaint && (
                <div className="border-l-4 border-red-500 pl-4">
                  <h3 className="text-lg font-medium text-gray-900 mb-2">{t('postvisit.chief_complaint')}</h3>
                  <p className="text-gray-700">{summaryData.chief_complaint}</p>
                </div>
              )}

              {/* Key Findings */}
              {summaryData.key_findings && summaryData.key_findings.length > 0 && (
                <div className="border-l-4 border-yellow-500 pl-4">
                  <h3 className="text-lg font-medium text-gray-900 mb-2">{t('postvisit.key_findings')}</h3>
                  <ul className="space-y-2">
                    {summaryData.key_findings.map((finding: string, index: number) => (
                      <li key={index} className="flex items-start">
                        <span className="text-yellow-600 mr-2 mt-1">•</span>
                        <span className="text-gray-700">{finding}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Diagnosis */}
              {summaryData.diagnosis && (
                <div className="border-l-4 border-green-500 pl-4">
                  <h3 className="text-lg font-medium text-gray-900 mb-2">{t('postvisit.diagnosis')}</h3>
                  <div className="prose max-w-none">
                    <p className="text-gray-700 whitespace-pre-wrap">{summaryData.diagnosis}</p>
                  </div>
                </div>
              )}

              {/* Medications */}
              {summaryData.medications && summaryData.medications.length > 0 && (
                <div className="border-l-4 border-purple-500 pl-4">
                  <h3 className="text-lg font-medium text-gray-900 mb-2">{t('postvisit.medications')}</h3>
                  <div className="space-y-2">
                    {summaryData.medications.map((med: any, index: number) => (
                      <div key={index} className="bg-gray-50 p-3 rounded">
                        <p className="font-medium">{med.name}</p>
                        {med.dosage && <p className="text-sm text-gray-600">{t('postvisit.dosage')}: {med.dosage}</p>}
                        {med.frequency && <p className="text-sm text-gray-600">{t('postvisit.frequency')}: {med.frequency}</p>}
                        {med.duration && <p className="text-sm text-gray-600">{t('postvisit.duration')}: {med.duration}</p>}
                        {med.purpose && <p className="text-sm text-gray-600">{t('postvisit.purpose')}: {med.purpose}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Other Recommendations */}
              {summaryData.other_recommendations && summaryData.other_recommendations.length > 0 && (
                <div className="border-l-4 border-blue-500 pl-4">
                  <h3 className="text-lg font-medium text-gray-900 mb-2">{t('postvisit.recommendations')}</h3>
                  <ul className="space-y-2">
                    {summaryData.other_recommendations.map((rec: string, index: number) => (
                      <li key={index} className="flex items-start">
                        <span className="text-blue-600 mr-2 mt-1">•</span>
                        <span className="text-gray-700">{rec}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Tests Ordered */}
              {summaryData.tests_ordered && summaryData.tests_ordered.length > 0 && (
                <div className="border-l-4 border-indigo-500 pl-4">
                  <h3 className="text-lg font-medium text-gray-900 mb-2">{t('postvisit.tests_ordered')}</h3>
                  <div className="space-y-2">
                    {summaryData.tests_ordered.map((test: any, index: number) => (
                      <div key={index} className="bg-gray-50 p-3 rounded">
                        {test.name && <p className="font-medium">{test.name}</p>}
                        {test.purpose && <p className="text-sm text-gray-600">{t('postvisit.purpose')}: {test.purpose}</p>}
                        {test.instructions && <p className="text-sm text-gray-600">{t('postvisit.instructions')}: {test.instructions}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Next Appointment */}
              {summaryData.next_appointment && (
                <div className="border-l-4 border-teal-500 pl-4">
                  <h3 className="text-lg font-medium text-gray-900 mb-2">{t('postvisit.next_appointment_title')}</h3>
                  <div className="prose max-w-none">
                    <p className="text-gray-700 whitespace-pre-wrap">{summaryData.next_appointment}</p>
                  </div>
                </div>
              )}

              {/* Red Flag Symptoms */}
              {summaryData.red_flag_symptoms && summaryData.red_flag_symptoms.length > 0 && (
                <div className="bg-red-50 p-4 rounded-lg">
                  <h3 className="text-lg font-medium text-red-900 mb-2">{t('postvisit.warning_signs')}</h3>
                  <ul className="space-y-2">
                    {summaryData.red_flag_symptoms.map((symptom: string, index: number) => (
                      <li key={index} className="flex items-start">
                        <span className="text-red-600 mr-2 mt-1">⚠</span>
                        <span className="text-red-800">{symptom}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Patient Instructions */}
              {summaryData.patient_instructions && summaryData.patient_instructions.length > 0 && (
                <div className="bg-yellow-50 p-4 rounded-lg">
                  <h3 className="text-lg font-medium text-yellow-900 mb-2">{t('postvisit.patient_instructions_title')}</h3>
                  <ul className="space-y-2">
                    {summaryData.patient_instructions.map((instruction: string, index: number) => (
                      <li key={index} className="flex items-start">
                        <span className="text-yellow-600 mr-2 mt-1">•</span>
                        <span className="text-yellow-800">{instruction}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Reassurance Note */}
              {summaryData.reassurance_note && (
                <div className="bg-green-50 p-4 rounded-lg">
                  <h3 className="text-lg font-medium text-green-900 mb-2">{t('postvisit.reassurance_note')}</h3>
                  <div className="prose max-w-none">
                    <p className="text-green-800 whitespace-pre-wrap">{summaryData.reassurance_note}</p>
                  </div>
                </div>
              )}

              {/* Contact Information */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="text-lg font-medium text-gray-900 mb-2">{t('postvisit.contact_information')}</h3>
                <div className="text-gray-700">
                  <p>{t('postvisit.contact_clinic')}</p>
                  <p className="mt-2"><strong>{t('postvisit.phone')}:</strong> {language === 'sp' ? '[Número de Teléfono de la Clínica]' : '[Clinic Phone Number]'}</p>
                  <p><strong>{t('postvisit.hours')}:</strong> {language === 'sp' ? '[Horario de la Clínica]' : '[Clinic Hours]'}</p>
                  <p><strong>{t('postvisit.emergency')}:</strong> {t('postvisit.emergency_text')}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Workflow Information */}
      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h3 className="text-sm font-medium text-blue-800 mb-2">{t('postvisit.walkin_workflow_complete')}</h3>
        <p className="text-sm text-blue-700">
          {t('postvisit.walkin_workflow_desc')}
        </p>
      </div>
    </div>
  );
};

export default WalkInPostVisit;
