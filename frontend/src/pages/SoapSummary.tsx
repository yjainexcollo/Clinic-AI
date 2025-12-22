import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  generateSoapNote,
  getSoapNote,
  getDoctorPreferences,
  DoctorPreferencesResponse,
} from "../services/patientService";
import { useLanguage } from "../contexts/LanguageContext";

const Block: React.FC<{ title: string; children?: React.ReactNode; t: (key: string) => string }> = ({ title, children, t }) => (
  <div className="mb-6">
    <h2 className="text-lg font-semibold mb-2">{title}</h2>
    <div className="whitespace-pre-wrap text-sm leading-6 bg-white/60 rounded-md p-3 border">
      {children || <span className="opacity-60">{t('soap.not_discussed')}</span>}
    </div>
  </div>
);

const render = (v: any, t: (key: string) => string) => (v == null ? t('soap.not_discussed') : String(v));

// Safe parser for Python dict format
function parsePythonDict(str: string): any {
  try {
    // Simple approach: replace single quotes with double quotes
    // This works for most cases but might break with apostrophes in strings
    const jsonStr = str.replace(/'/g, '"');
    const result = JSON.parse(jsonStr);
    return result;
  } catch (e) {
    // If that fails, try a more careful approach
    // Handle common cases where apostrophes might be in the data
    let result = str;
    
    // Replace single quotes around keys and values, but preserve apostrophes in the middle
    result = result.replace(/'([^']*)':/g, '"$1":'); // Keys
    result = result.replace(/: '([^']*)'/g, ': "$1"'); // Values
    
    try {
      const parsed = JSON.parse(result);
      return parsed;
    } catch (e2) {
      // Last resort: return the original string
      return str;
    }
  }
}

function renderObjective(obj: any, t: (key: string) => string): React.ReactNode {
  if (obj == null) return <span className="opacity-60">{t('soap.not_discussed')}</span>;
  let data: any = obj;
  
  // If it's already an object, use it directly
  if (typeof obj === "object" && !Array.isArray(obj)) {
    data = obj;
  } else if (typeof obj === "string") {
    const t = obj.trim();
    
    // Check if it's a JSON string containing Python dict format
    if (t.startsWith('"{') && t.endsWith('}"')) {
      try {
        // First parse the JSON string to get the Python dict string
        const pythonDictString = JSON.parse(t);
        // Then parse the Python dict
        data = parsePythonDict(pythonDictString);
      } catch (e) {
        // fall through to raw string
      }
    } else if ((t.startsWith("{") && t.endsWith("}")) || (t.startsWith("[") && t.endsWith("]"))) {
      try {
        // First try standard JSON parsing
        data = JSON.parse(t);
      } catch {
        try {
          // If that fails, try to convert Python dict format to JSON format
          const jsonString = t.replace(/'/g, '"');
          data = JSON.parse(jsonString);
        } catch {
          // If that also fails, try a more sophisticated approach
          try {
            data = parsePythonDict(t);
          } catch (e) {
            // fall through to raw string
          }
        }
      }
    }
  }
  if (data && typeof data === "object" && !Array.isArray(data)) {
    const vital = data.vital_signs || data.vitals || data.vitalSigns;
    const physical = data.physical_exam || data.exam || data.physicalExam;
    return (
      <div className="space-y-3">
        {vital && typeof vital === "object" && (
          <div>
            <div className="text-sm font-semibold mb-1">Vital Signs</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {Object.entries(vital).map(([k, v]) => (
                <div key={k} className="flex items-start gap-2 text-sm">
                  <span className="min-w-28 font-medium capitalize text-gray-700">{k.replace(/_/g, " ")}</span>
                  <span className="flex-1">{String(v)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {physical && (
          <div>
            <div className="text-sm font-semibold mb-1">Physical Exam</div>
            {typeof physical === "object" && !Array.isArray(physical) ? (
              <div className="space-y-2">
                {Object.entries(physical).map(([k, v]) => (
                  <div key={k} className="flex items-start gap-2 text-sm">
                    <span className="min-w-28 font-medium capitalize text-gray-700">{k.replace(/_/g, " ")}</span>
                    <span className="flex-1">{String(v)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm whitespace-pre-wrap">{String(physical)}</div>
            )}
          </div>
        )}
        {!vital && !physical && (
          <div className="space-y-2">
            {Object.entries(data).map(([k, v]) => (
              <div key={k} className="flex items-start gap-2 text-sm">
                <span className="min-w-28 font-medium capitalize text-gray-700">{k.replace(/_/g, " ")}</span>
                <span className="flex-1">
                  {typeof v === "object" && v !== null ? (
                    <div className="space-y-1">
                      {Object.entries(v).map(([subK, subV]) => (
                        <div key={subK} className="flex items-start gap-2">
                          <span className="min-w-20 text-xs font-medium text-gray-600">{subK.replace(/_/g, " ")}</span>
                          <span className="text-xs">{String(subV)}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    String(v)
                  )}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }
  
  // If we still have a string that looks like a dict, try one more time
  if (typeof data === "string" && data.includes("'vital_signs'") && data.includes("'physical_exam'")) {
    try {
      const finalResult = parsePythonDict(data);
      if (typeof finalResult === "object" && finalResult !== null) {
        data = finalResult;
      }
    } catch (e) {
      // fall through
    }
  }
  
  // If data is still a string, show it as formatted text instead of raw
  if (typeof data === "string") {
    return (
      <div className="text-sm text-red-600 bg-red-50 p-3 rounded border">
        <strong>Raw Data:</strong> {data}
      </div>
    );
  }
  
  return <span className="whitespace-pre-wrap">{String(data)}</span>;
}

const SoapSummary: React.FC = () => {
  const { patientId = "", visitId = "" } = useParams();
  const navigate = useNavigate();
  const { language, setLanguage, t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [soap, setSoap] = useState<any>(null);
  const [soapOrder, setSoapOrder] = useState<string[]>(["subjective", "objective", "assessment", "plan"]);
  const [showGenerationPanel, setShowGenerationPanel] = useState(false);
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

  async function load() {
    if (!patientId || !visitId) {
      setError("Missing patient or visit id");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      // Try to fetch existing SOAP; if not found, show generation panel
      try {
        const s = await getSoapNote(patientId, visitId);
        setSoap(s);
      } catch {
        // SOAP doesn't exist, show generation panel
        setSoap(null);
        setShowGenerationPanel(true);
      }
    } catch (e: any) {
      setError(e?.message || "Failed to load SOAP note");
    } finally {
      setLoading(false);
    }
  }

  const handleGenerateSoap = async () => {
    setLoading(true);
    setError("");
    
    try {
      let template: any = undefined;
      
      const hasTemplateContent =
        !!soapTemplateContent.subjective.trim() ||
        !!soapTemplateContent.objective.trim() ||
        !!soapTemplateContent.assessment.trim() ||
        !!soapTemplateContent.plan.trim();

      if (useTemplate && hasTemplateContent) {
        template = {
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

      await generateSoapNote(patientId, visitId, template);
      const s = await getSoapNote(patientId, visitId);
      setSoap(s);
      setShowGenerationPanel(false);
    } catch (e: any) {
      setError(e?.message || "Failed to generate SOAP note");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Load SOAP note
    load();
    // Load doctor preferences (SOAP order)
    (async () => {
      try {
        const pref: DoctorPreferencesResponse = await getDoctorPreferences();
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
      } catch {
        // On any error, silently fall back to default order
        setSoapOrder(["subjective", "objective", "assessment", "plan"]);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId, visitId]);

  if (loading && !showGenerationPanel) return <div className="p-4">{t('soap.loading')}</div>;
  if (error && !showGenerationPanel) return <div className="p-4 text-red-600">{error}</div>;
  
  // Show generation panel if SOAP doesn't exist
  if (!soap && showGenerationPanel) {
    return (
      <div className="max-w-4xl mx-auto p-4">
        <div className="mb-6">
          <button
            onClick={() => navigate(`/intake/${patientId}?v=${visitId}&done=1`)}
            className="mb-3 inline-flex items-center px-3 py-1.5 rounded bg-gray-200 hover:bg-gray-300 text-gray-800"
          >
            ← {t('soap.back_to_main')}
          </button>
          <h1 className="text-2xl font-bold">
            {t('soap.title')}
          </h1>
          <p className="text-xs opacity-60">
            {t('soap.patient_visit', { patientId, visitId })}
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">SOAP Generation Settings</h3>
              <p className="text-gray-600 text-sm">
                You can fill this template form to guide the SOAP summary for this visit, or skip it and
                generate using the default format.
              </p>
            </div>

            <div className="border rounded-lg p-4 bg-gray-50">
              <div className="flex items-center justify-between mb-3">
                <label className="flex items-center space-x-2 text-sm text-gray-800">
                  <input
                    type="checkbox"
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    checked={useTemplate}
                    onChange={(e) => setUseTemplate(e.target.checked)}
                  />
                  <span>Use custom SOAP template for this generation only</span>
                </label>
                <span className="text-xs text-gray-500">
                  If unchecked, the default SOAP structure is used.
                </span>
              </div>

              {useTemplate && (
                <div className="space-y-4 mt-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Template Name</label>
                      <input
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        value={templateName}
                        onChange={(e) => setTemplateName(e.target.value)}
                        placeholder="e.g., General Template"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                      <input
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        value={templateCategory}
                        onChange={(e) => setTemplateCategory(e.target.value)}
                        placeholder="e.g., General / Primary Care"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Speciality</label>
                      <input
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        value={templateSpeciality}
                        onChange={(e) => setTemplateSpeciality(e.target.value)}
                        placeholder="e.g., Primary Care"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Description (optional)
                    </label>
                    <textarea
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-h-[60px]"
                      value={templateDescription}
                      onChange={(e) => setTemplateDescription(e.target.value)}
                      placeholder="Describe how you want this SOAP summary to be structured."
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Tags (comma-separated)
                      </label>
                      <input
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        value={templateTags}
                        onChange={(e) => setTemplateTags(e.target.value)}
                        placeholder="e.g., Test, Follow-up, Primary Care"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Appointment Types (comma-separated)
                      </label>
                      <input
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        value={templateAppointmentTypes}
                        onChange={(e) => setTemplateAppointmentTypes(e.target.value)}
                        placeholder="e.g., Follow-up, Consultation"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Status
                      </label>
                      <select
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        value={templateStatus}
                        onChange={(e) => setTemplateStatus(e.target.value)}
                      >
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                        <option value="draft">Draft</option>
                      </select>
                    </div>
                    <div className="flex items-center pt-6">
                      <label className="flex items-center gap-2 text-sm text-gray-800">
                        <input
                          type="checkbox"
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          checked={templateIsFavorite}
                          onChange={(e) => setTemplateIsFavorite(e.target.checked)}
                        />
                        Mark as favorite
                      </label>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Subjective Template
                      </label>
                      <textarea
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-h-[90px]"
                        value={soapTemplateContent.subjective}
                        onChange={(e) =>
                          setSoapTemplateContent((prev) => ({ ...prev, subjective: e.target.value }))
                        }
                        placeholder="e.g., Patient reports [symptoms] for [duration]..."
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Objective Template
                      </label>
                      <textarea
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-h-[90px]"
                        value={soapTemplateContent.objective}
                        onChange={(e) =>
                          setSoapTemplateContent((prev) => ({ ...prev, objective: e.target.value }))
                        }
                        placeholder="e.g., Vital signs: [blood_pressure], [heart_rate]..."
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Assessment Template
                      </label>
                      <textarea
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-h-[90px]"
                        value={soapTemplateContent.assessment}
                        onChange={(e) =>
                          setSoapTemplateContent((prev) => ({ ...prev, assessment: e.target.value }))
                        }
                        placeholder="e.g., Clinical impression: [assessment]..."
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Plan Template
                      </label>
                      <textarea
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-h-[90px]"
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
                    navigate(`/intake/${patientId}?v=${visitId}&done=1`);
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm text-gray-700 bg-white hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleGenerateSoap}
                  disabled={loading}
                  className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? "Generating..." : "Generate SOAP Summary"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  if (!soap) return <div className="p-4">{t('soap.no_data')}</div>;

  // Extract SOAP data - handle both direct structure and wrapped in soap_note
  const soapData = (soap as any).soap_note || (soap as any).soap || soap;
  const subj = soapData?.subjective ?? soap?.subjective ?? null;
  const obj = soapData?.objective ?? soap?.objective ?? null;
  const assess = soapData?.assessment ?? soap?.assessment ?? null;
  const plan = soapData?.plan ?? soap?.plan ?? null;
  
  console.log('SOAP data extracted:', { subj, obj, assess, plan, rawSoap: soap });

  return (
    <div className="max-w-4xl mx-auto p-4">
      <div className="mb-6">
        <button
          onClick={() => navigate(`/intake/${patientId}?v=${visitId}&done=1`)}
          className="mb-3 inline-flex items-center px-3 py-1.5 rounded bg-gray-200 hover:bg-gray-300 text-gray-800"
        >
          ← {t('soap.back_to_main')}
        </button>
        <h1 className="text-2xl font-bold">
          {t('soap.title')}
        </h1>
        <p className="text-xs opacity-60">
          {t('soap.patient_visit', { patientId, visitId })}
        </p>
        {soap.generated_at && (
          <p className="text-xs opacity-60">
            {t('soap.generated')}: {new Date(soap.generated_at).toLocaleString()}
          </p>
        )}
      </div>

      {soapOrder.map((sectionKey) => {
        const key = sectionKey.toLowerCase();
        if (key === "subjective") {
          return (
            <Block key="subjective" title={t("soap.subjective")} t={t}>
              {render(subj, t)}
            </Block>
          );
        }
        if (key === "objective") {
          return (
            <Block key="objective" title={t("soap.objective")} t={t}>
              {renderObjective(obj, t)}
            </Block>
          );
        }
        if (key === "assessment") {
          return (
            <Block key="assessment" title={t("soap.assessment")} t={t}>
              {render(assess, t)}
            </Block>
          );
        }
        if (key === "plan") {
          return (
            <Block key="plan" title={t("soap.plan")} t={t}>
              {render(plan, t)}
            </Block>
          );
        }
        return null;
      })}


    </div>
  );
};

export default SoapSummary;