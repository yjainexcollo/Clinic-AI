import React, { useState, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { BACKEND_BASE_URL, authorizedFetch, getDoctorPreferences } from "../services/patientService";
import { workflowService } from "../services/workflowService";
import { useLanguage } from "../contexts/LanguageContext";

const WalkInSoap: React.FC = () => {
  const { patientId = "", visitId = "" } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { language, t } = useLanguage();
  const searchParams = new URLSearchParams(location.search);
  const autoOpenGeneration = searchParams.get("action") === "generate";
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [soapData, setSoapData] = useState<any>(null);
  const [workflowInfo, setWorkflowInfo] = useState<any>(null);
  const [soapOrder, setSoapOrder] = useState<string[]>(["subjective", "objective", "assessment", "plan"]);
  const [showGenerationPanel, setShowGenerationPanel] = useState(autoOpenGeneration);
  const [useTemplate, setUseTemplate] = useState(false);
  const [templateName, setTemplateName] = useState<string>("");
  const [templateCategory, setTemplateCategory] = useState<string>("");
  const [templateSpeciality, setTemplateSpeciality] = useState<string>("");
  const [templateDescription, setTemplateDescription] = useState<string>("");
  const [templateTags, setTemplateTags] = useState<string>("");
  const [templateAppointmentTypes, setTemplateAppointmentTypes] = useState<string>("");
  const [templateIsFavorite, setTemplateIsFavorite] = useState<boolean>(false);
  const [templateStatus, setTemplateStatus] = useState<string>("active");
  const [soapTemplateContent, setSoapTemplateContent] = useState<{
    subjective: string;
    objective: string;
    assessment: string;
    plan: string;
  }>({
    subjective: "",
    objective: "",
    assessment: "",
    plan: "",
  });

  // Fetch SOAP data and workflow information
  useEffect(() => {
    const fetchData = async () => {
      if (!patientId || !visitId) return;
      
      setLoading(true);
      try {
        // Load doctor preferences to honor SOAP ordering (reuse logic from scheduled flow)
        try {
          const pref = await getDoctorPreferences();
          const DEFAULT_SOAP = ["subjective", "objective", "assessment", "plan"];
          const allowed = new Set(DEFAULT_SOAP);
          const fromServer = Array.isArray(pref.soap_order) ? pref.soap_order : [];
          const cleaned: string[] = [];
          const seen = new Set<string>();
          for (const key of fromServer) {
            const lower = (key || "").toString().trim().toLowerCase();
            if (allowed.has(lower) && !seen.has(lower)) {
              cleaned.push(lower);
              seen.add(lower);
            }
          }
          // Append any missing keys in default order
          for (const key of DEFAULT_SOAP) {
            if (!seen.has(key)) {
              cleaned.push(key);
              seen.add(key);
            }
          }
          setSoapOrder(cleaned.length ? cleaned : DEFAULT_SOAP);
        } catch (prefErr) {
          console.warn("Failed to load doctor preferences for SOAP order (walk-in):", prefErr);
          setSoapOrder(["subjective", "objective", "assessment", "plan"]);
        }

        // Fetch SOAP data
        const soapResponse = await authorizedFetch(`${BACKEND_BASE_URL}/notes/${encodeURIComponent(patientId)}/visits/${encodeURIComponent(visitId)}/soap`, {
          headers: { Accept: "application/json" },
        });

        if (soapResponse.ok) {
          const response = await soapResponse.json();
          // Extract data from ApiResponse wrapper (backend returns {success, data, message})
          const soap = response.data || response.soap_note || response;
          setSoapData(soap);
        } else if (soapResponse.status === 404) {
          // SOAP not generated yet, that's okay
          setSoapData(null);
        } else {
          throw new Error(`Failed to fetch SOAP: ${soapResponse.status}`);
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

  const generateSoap = async () => {
    setLoading(true);
    setError("");
    
    try {
      const payload: any = {
        patient_id: patientId,
        visit_id: visitId,
      };

      const hasTemplateContent =
        !!soapTemplateContent.subjective.trim() ||
        !!soapTemplateContent.objective.trim() ||
        !!soapTemplateContent.assessment.trim() ||
        !!soapTemplateContent.plan.trim();

      if (useTemplate && hasTemplateContent) {
        payload.template = {
          template_name: templateName || "Ad-hoc SOAP Template",
          category: templateCategory || undefined,
          speciality: templateSpeciality || undefined,
          description: templateDescription || undefined,
          soap_content: {
            subjective: soapTemplateContent.subjective || undefined,
            objective: soapTemplateContent.objective || undefined,
            assessment: soapTemplateContent.assessment || undefined,
            plan: soapTemplateContent.plan || undefined,
          },
          tags: templateTags ? templateTags.split(',').map(t => t.trim()).filter(t => t) : undefined,
          appointment_types: templateAppointmentTypes ? templateAppointmentTypes.split(',').map(t => t.trim()).filter(t => t) : undefined,
          is_favorite: templateIsFavorite || undefined,
          status: templateStatus || undefined,
          uploaded_at: new Date().toISOString(),
        };
      }

      const response = await authorizedFetch(`${BACKEND_BASE_URL}/notes/soap/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Failed to generate SOAP: ${response.status} - ${errorData}`);
      }

      // After generating, fetch the SOAP data
      const soapResponse = await authorizedFetch(`${BACKEND_BASE_URL}/notes/${encodeURIComponent(patientId)}/visits/${encodeURIComponent(visitId)}/soap`, {
        headers: { Accept: "application/json" },
      });

      if (soapResponse.ok) {
        const response = await soapResponse.json();
        // Extract data from ApiResponse wrapper (backend returns {success, data, message})
        const soap = response.data || response.soap_note || response;
        setSoapData(soap);
      }

      // Refresh workflow steps after generating SOAP
      try {
        const stepsResponse = await workflowService.getAvailableSteps(visitId);
        setWorkflowInfo(stepsResponse);
      } catch (error) {
        console.error("Error refreshing workflow steps:", error);
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate SOAP");
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
          <h1 className="text-2xl font-bold text-gray-900">{t("soap.walkin_title")}</h1>
          <p className="text-sm text-gray-600 mt-1">
            {t("soap.patient_visit", { patientId, visitId })}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            {t("soap.walkin_workflow")}
          </span>
          <button
            onClick={handleBack}
            className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
          >
            {t("common.back")}
          </button>
        </div>
      </div>

      {/* Workflow Status */}
      {workflowInfo && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
          <h3 className="text-sm font-medium text-green-800 mb-2">{t("soap.current_status")}</h3>
          <p className="text-sm text-green-700">
            <strong>{t("soap.current_step")}:</strong> {t("soap.soap_generation")}
          </p>
          <p className="text-sm text-green-700">
            <strong>{t("soap.next_step")}:</strong> {t("soap.postvisit_summary")}
          </p>
        </div>
      )}


      {/* Error Message */}
      {error && (
        <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* SOAP Content */}
      <div className="bg-white rounded-lg border border-gray-200">
        {!soapData ? (
          <div className="p-6">
            {!showGenerationPanel ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">{t("soap.not_generated")}</h3>
                <p className="text-gray-600 mb-6">
                  {t("soap.prepare_generation_message")}
                </p>
                <button
                  onClick={() => setShowGenerationPanel(true)}
                  className="px-6 py-3 bg-green-600 text-white rounded-md hover:bg-green-700"
                >
                  {t("soap.prepare_generation")}
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">{t("soap.generation_settings")}</h3>
                  <p className="text-gray-600 text-sm">
                    {t("soap.generation_settings_message")}
                  </p>
                </div>

                <div className="border rounded-lg p-4 bg-gray-50">
                  <div className="flex items-center justify-between mb-3">
                    <label className="flex items-center space-x-2 text-sm text-gray-800">
                      <input
                        type="checkbox"
                        className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                        checked={useTemplate}
                        onChange={(e) => setUseTemplate(e.target.checked)}
                      />
                      <span>{t("soap.use_custom_template")}</span>
                    </label>
                    <span className="text-xs text-gray-500">
                      {t("soap.default_structure_note")}
                    </span>
                  </div>

                  {useTemplate && (
                    <div className="space-y-4 mt-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">{t("soap.template_name")}</label>
                          <input
                            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                            value={templateName}
                            onChange={(e) => setTemplateName(e.target.value)}
                            placeholder="e.g., General Template"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">{t("soap.template_category")}</label>
                          <input
                            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                            value={templateCategory}
                            onChange={(e) => setTemplateCategory(e.target.value)}
                            placeholder="e.g., General / Primary Care"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">{t("soap.template_speciality")}</label>
                          <input
                            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                            value={templateSpeciality}
                            onChange={(e) => setTemplateSpeciality(e.target.value)}
                            placeholder="e.g., Primary Care"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          {t("soap.template_description")}
                        </label>
                        <textarea
                          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 min-h-[60px]"
                          value={templateDescription}
                          onChange={(e) => setTemplateDescription(e.target.value)}
                          placeholder="Describe how you want this SOAP summary to be structured."
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            {t("soap.template_tags")}
                          </label>
                          <input
                            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                            value={templateTags}
                            onChange={(e) => setTemplateTags(e.target.value)}
                            placeholder="e.g., Test, Follow-up, Primary Care"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            {t("soap.template_appointment_types")}
                          </label>
                          <input
                            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                            value={templateAppointmentTypes}
                            onChange={(e) => setTemplateAppointmentTypes(e.target.value)}
                            placeholder="e.g., Follow-up, Consultation"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            {t("soap.template_status")}
                          </label>
                          <select
                            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                            value={templateStatus}
                            onChange={(e) => setTemplateStatus(e.target.value)}
                          >
                            <option value="active">{t("soap.status_active")}</option>
                            <option value="inactive">{t("soap.status_inactive")}</option>
                            <option value="draft">{t("soap.status_draft")}</option>
                          </select>
                        </div>
                        <div className="flex items-center pt-6">
                          <label className="flex items-center gap-2 text-sm text-gray-800">
                            <input
                              type="checkbox"
                              className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                              checked={templateIsFavorite}
                              onChange={(e) => setTemplateIsFavorite(e.target.checked)}
                            />
                            {t("soap.template_mark_favorite")}
                          </label>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            {t("soap.template_subjective")}
                          </label>
                          <textarea
                            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 min-h-[90px]"
                            value={soapTemplateContent.subjective}
                            onChange={(e) =>
                              setSoapTemplateContent((prev) => ({ ...prev, subjective: e.target.value }))
                            }
                            placeholder="e.g., Patient reports [symptoms] for [duration]..."
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            {t("soap.template_objective")}
                          </label>
                          <textarea
                            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 min-h-[90px]"
                            value={soapTemplateContent.objective}
                            onChange={(e) =>
                              setSoapTemplateContent((prev) => ({ ...prev, objective: e.target.value }))
                            }
                            placeholder="e.g., Vital signs: [blood_pressure], [heart_rate]..."
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            {t("soap.template_assessment")}
                          </label>
                          <textarea
                            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 min-h-[90px]"
                            value={soapTemplateContent.assessment}
                            onChange={(e) =>
                              setSoapTemplateContent((prev) => ({ ...prev, assessment: e.target.value }))
                            }
                            placeholder="e.g., Clinical impression: [assessment]..."
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            {t("soap.template_plan")}
                          </label>
                          <textarea
                            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 min-h-[90px]"
                            value={soapTemplateContent.plan}
                            onChange={(e) =>
                              setSoapTemplateContent((prev) => ({ ...prev, plan: e.target.value }))
                            }
                            placeholder="e.g., Plan: [treatments], [follow_up]..."
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="mt-6 flex flex-wrap gap-3 justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        setShowGenerationPanel(false);
                        setUseTemplate(false);
                      }}
                      className="px-4 py-2 border border-gray-300 rounded-md text-sm text-gray-700 bg-white hover:bg-gray-50"
                    >
                      {t("soap.back_to_actions")}
                    </button>
                    <button
                      onClick={generateSoap}
                      disabled={loading}
                      className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loading ? t("soap.generating") : t("soap.generate_summary")}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">{t("soap.title")}</h2>
            </div>

            {/* SOAP Sections (ordered by doctor preferences) */}
            <div className="space-y-6">
              {soapOrder.map((section) => {
                if (section === "subjective") {
                  return (
                    <div key="subjective" className="border-l-4 border-blue-500 pl-4">
                      <h3 className="text-lg font-medium text-gray-900 mb-2">{t("soap.subjective")}</h3>
                      <div className="prose max-w-none">
                        <p className="text-gray-700 whitespace-pre-wrap">
                          {soapData.subjective || (language === 'sp' ? "No hay información subjetiva disponible." : "No subjective information available.")}
                        </p>
                      </div>
                    </div>
                  );
                }

                if (section === "objective") {
                  return (
                    <div key="objective" className="border-l-4 border-green-500 pl-4">
                      <h3 className="text-lg font-medium text-gray-900 mb-2">{t("soap.objective")}</h3>
                      <div className="prose max-w-none">
                        {soapData.objective ? (
                          <div className="text-gray-700">
                            {typeof soapData.objective === "string" ? (
                              <p className="whitespace-pre-wrap">{soapData.objective}</p>
                            ) : (
                              <div>
                                {soapData.objective.vital_signs && (
                                  <div className="mb-4">
                                    <h4 className="font-medium text-gray-900 mb-2">
                                      {t("soap.vital_signs")}:
                                    </h4>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                      {Object.entries(soapData.objective.vital_signs).map(([key, value]) => {
                                        const translateKey = (k: string): string => {
                                          const keyMap: Record<string, string> = {
                                            'blood_pressure': language === 'sp' ? 'Presión Arterial' : 'Blood Pressure',
                                            'heart_rate': language === 'sp' ? 'Frecuencia Cardíaca' : 'Heart Rate',
                                            'temperature': language === 'sp' ? 'Temperatura' : 'Temperature',
                                            'spo2': language === 'sp' ? 'SpO2' : 'SpO2',
                                            'spO2': language === 'sp' ? 'SpO2' : 'SpO2',
                                            'weight': language === 'sp' ? 'Peso' : 'Weight',
                                            'height': language === 'sp' ? 'Altura' : 'Height',
                                            'respiratory_rate': language === 'sp' ? 'Frecuencia Respiratoria' : 'Respiratory Rate',
                                          };
                                          return keyMap[k.toLowerCase()] || k.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                                        };
                                        return (
                                          <div key={key} className="bg-gray-50 p-2 rounded">
                                            <span className="font-medium">{translateKey(key)}:</span>{" "}
                                            {String(value)}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}
                                {soapData.objective.physical_exam && (
                                  <div>
                                    <h4 className="font-medium text-gray-900 mb-2">
                                      {t("soap.physical_exam")}:
                                    </h4>
                                    {typeof soapData.objective.physical_exam === "object" && !Array.isArray(soapData.objective.physical_exam) ? (
                                      <div className="space-y-2">
                                        {Object.entries(soapData.objective.physical_exam).map(([key, value]) => {
                                          const translateExamKey = (k: string): string => {
                                            const keyMap: Record<string, string> = {
                                              'general_appearance': language === 'sp' ? 'Apariencia General' : 'General Appearance',
                                              'heent': language === 'sp' ? 'HEENT' : 'HEENT',
                                              'cardiac': language === 'sp' ? 'Cardíaco' : 'Cardiac',
                                              'respiratory': language === 'sp' ? 'Respiratorio' : 'Respiratory',
                                              'abdominal': language === 'sp' ? 'Abdominal' : 'Abdominal',
                                              'neuro': language === 'sp' ? 'Neurológico' : 'Neuro',
                                              'extremities': language === 'sp' ? 'Extremidades' : 'Extremities',
                                              'gait': language === 'sp' ? 'Marcha' : 'Gait',
                                            };
                                            return keyMap[k.toLowerCase()] || k.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                                          };
                                          return (
                                            <div key={key} className="flex items-start gap-2 text-sm">
                                              <span className="min-w-28 font-medium text-gray-700">{translateExamKey(key)}:</span>
                                              <span className="flex-1">{String(value)}</span>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    ) : (
                                      <p className="whitespace-pre-wrap">
                                        {JSON.stringify(soapData.objective.physical_exam, null, 2)}
                                      </p>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        ) : (
                          <p className="text-gray-700">
                            {language === 'sp' ? "No hay información objetiva disponible." : "No objective information available."}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                }

                if (section === "assessment") {
                  return (
                    <div key="assessment" className="border-l-4 border-yellow-500 pl-4">
                      <h3 className="text-lg font-medium text-gray-900 mb-2">{t("soap.assessment")}</h3>
                      <div className="prose max-w-none">
                        <p className="text-gray-700 whitespace-pre-wrap">
                          {soapData.assessment || (language === 'sp' ? "No hay evaluación disponible." : "No assessment available.")}
                        </p>
                      </div>
                    </div>
                  );
                }

                if (section === "plan") {
                  return (
                    <div key="plan" className="border-l-4 border-red-500 pl-4">
                      <h3 className="text-lg font-medium text-gray-900 mb-2">{t("soap.plan")}</h3>
                      <div className="prose max-w-none">
                        <p className="text-gray-700 whitespace-pre-wrap">
                          {soapData.plan || (language === 'sp' ? "No hay plan disponible." : "No plan available.")}
                        </p>
                      </div>
                    </div>
                  );
                }

                return null;
              })}
              {/* Highlights and Red Flags */}
              {(soapData.highlights || soapData.red_flags) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {soapData.highlights && soapData.highlights.length > 0 && (
                    <div className="bg-blue-50 p-4 rounded-lg">
                      <h4 className="font-medium text-blue-900 mb-2">
                        {t("soap.key_highlights")}
                      </h4>
                      <ul className="text-sm text-blue-800 space-y-1">
                        {soapData.highlights.map((highlight: string, index: number) => (
                          <li key={index} className="flex items-start">
                            <span className="text-blue-500 mr-2">•</span>
                            {highlight}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {soapData.red_flags && soapData.red_flags.length > 0 && (
                    <div className="bg-red-50 p-4 rounded-lg">
                      <h4 className="font-medium text-red-900 mb-2">
                        {t("soap.red_flags")}
                      </h4>
                      <ul className="text-sm text-red-800 space-y-1">
                        {soapData.red_flags.map((flag: string, index: number) => (
                          <li key={index} className="flex items-start">
                            <span className="text-red-500 mr-2">⚠</span>
                            {flag}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* Model Information */}
              {soapData.model_info && (
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-medium text-gray-900 mb-2">{t("soap.generation_details")}</h4>
                  <div className="text-sm text-gray-600">
                    <p><strong>{language === 'sp' ? "Modelo:" : "Model:"}</strong> {soapData.model_info.model || (language === 'sp' ? "Desconocido" : "Unknown")}</p>
                    <p><strong>{language === 'sp' ? "Generado:" : "Generated:"}</strong> {new Date(soapData.generated_at).toLocaleString()}</p>
                    {soapData.confidence_score && (
                      <p><strong>{language === 'sp' ? "Confianza:" : "Confidence:"}</strong> {(soapData.confidence_score * 100).toFixed(1)}%</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Workflow Information */}
      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h3 className="text-sm font-medium text-blue-800 mb-2">{t("soap.walkin_info")}</h3>
        <p className="text-sm text-blue-700">
          {language === 'sp' 
            ? "La nota SOAP se genera basándose en la transcripción del paciente y los datos de signos vitales. Después de revisar la nota SOAP, procederá a crear el resumen post-consulta para el paciente."
            : "The SOAP note is generated based on the patient's transcription and vitals data. After reviewing the SOAP note, you'll proceed to create the post-visit summary for the patient."}
        </p>
      </div>
    </div>
  );
};

export default WalkInSoap;