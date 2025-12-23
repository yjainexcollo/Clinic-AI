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

const translateLabel = (key: string, t: (key: string) => string): string => {
  const normalized = key.replace(/_/g, " ").trim().toLowerCase();
  const map: Record<string, string> = {
    "blood pressure": t("vitals.blood_pressure"),
    "systolic": t("vitals.systolic"),
    "diastolic": t("vitals.diastolic"),
    "heart rate": t("vitals.heart_rate"),
    "pulse": t("vitals.heart_rate"),
    "temperature": t("vitals.temperature"),
    "oxygen": t("vitals.oxygen_saturation"),
    "spo2": t("vitals.oxygen_saturation"),
    "oxygen saturation": t("vitals.oxygen_saturation"),
    "weight": t("vitals.weight"),
    "height": t("vitals.height"),
    "bmi": t("vitals.calculated_bmi"),
    "respiratory rate": t("vitals.respiratory_rate"),
    "general appearance": t("physical.general_appearance"),
    "heent": t("physical.heent"),
    "cardiac": t("physical.cardiac"),
    "respiratory": t("physical.respiratory"),
    "abdominal": t("physical.abdominal"),
    "neuro": t("physical.neuro"),
    "extremities": t("physical.extremities"),
    "gait": t("physical.gait"),
  };
  return map[normalized] || key.replace(/_/g, " ");
};

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
            <div className="text-sm font-semibold mb-1">{t("soap.vital_signs")}</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {Object.entries(vital).map(([k, v]) => (
                <div key={k} className="flex items-start gap-2 text-sm">
                  <span className="min-w-28 font-medium capitalize text-gray-700">{translateLabel(k, t)}</span>
                  <span className="flex-1">{String(v)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {physical && (
          <div>
            <div className="text-sm font-semibold mb-1">{t("soap.physical_examination")}</div>
            {typeof physical === "object" && !Array.isArray(physical) ? (
              <div className="space-y-2">
                {Object.entries(physical).map(([k, v]) => (
                  <div key={k} className="flex items-start gap-2 text-sm">
                    <span className="min-w-28 font-medium capitalize text-gray-700">{translateLabel(k, t)}</span>
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
                <span className="min-w-28 font-medium capitalize text-gray-700">{translateLabel(k, t)}</span>
                <span className="flex-1">
                  {typeof v === "object" && v !== null ? (
                    <div className="space-y-1">
                      {Object.entries(v).map(([subK, subV]) => (
                        <div key={subK} className="flex items-start gap-2">
                          <span className="min-w-20 text-xs font-medium text-gray-600">{translateLabel(subK, t)}</span>
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

  async function load() {
    if (!patientId || !visitId) {
      setError("Missing patient or visit id");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      // Try to fetch existing SOAP; if not found, generate then fetch
      try {
        const s = await getSoapNote(patientId, visitId);
        setSoap(s);
      } catch {
        await generateSoapNote(patientId, visitId);
        const s2 = await getSoapNote(patientId, visitId);
        setSoap(s2);
      }
    } catch (e: any) {
      setError(e?.message || "Failed to load SOAP note");
    } finally {
      setLoading(false);
    }
  }

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

  if (loading) return <div className="p-4">{t('soap.loading')}</div>;
  if (error) return <div className="p-4 text-red-600">{error}</div>;
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