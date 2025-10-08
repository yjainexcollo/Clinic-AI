import React, { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { generateSoapNote, getSoapNote } from "../services/patientService";
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
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId, visitId]);

  if (loading) return <div className="p-4">{t('soap.loading')}</div>;
  if (error) return <div className="p-4 text-red-600">{error}</div>;
  if (!soap) return <div className="p-4">{t('soap.no_data')}</div>;

  const subj = (soap as any).soap?.subjective ?? soap.subjective;
  const obj = (soap as any).soap?.objective ?? soap.objective;
  const assess = (soap as any).soap?.assessment ?? soap.assessment;
  const plan = (soap as any).soap?.plan ?? soap.plan;

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

      <Block title={t('soap.subjective')} t={t}>{render(subj, t)}</Block>
      <Block title={t('soap.objective')} t={t}>{renderObjective(obj, t)}</Block>
      <Block title={t('soap.assessment')} t={t}>{render(assess, t)}</Block>
      <Block title={t('soap.plan')} t={t}>{render(plan, t)}</Block>


      <div className="flex gap-2 flex-wrap">
        <Link
          to={`/intake/${patientId}?v=${visitId}&done=1`}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          {t('soap.back_to_main')}
        </Link>
      </div>
    </div>
  );
};

export default SoapSummary;