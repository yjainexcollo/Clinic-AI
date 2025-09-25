import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { generateSoapNote, getSoapNote } from "../services/patientService";

const Block: React.FC<{ title: string; children?: React.ReactNode }> = ({ title, children }) => (
  <div className="mb-6">
    <h2 className="text-lg font-semibold mb-2">{title}</h2>
    <div className="whitespace-pre-wrap text-sm leading-6 bg-white/60 rounded-md p-3 border">
      {children || <span className="opacity-60">Not discussed</span>}
    </div>
  </div>
);

const render = (v: any) => (v == null ? "Not discussed" : String(v));

function renderObjective(obj: any): React.ReactNode {
  if (obj == null) return <span className="opacity-60">Not discussed</span>;
  let data: any = obj;
  if (typeof obj === "string") {
    const t = obj.trim();
    if ((t.startsWith("{") && t.endsWith("}")) || (t.startsWith("[") && t.endsWith("]"))) {
      try {
        data = JSON.parse(t);
      } catch {
        // fall through to raw string
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
                  <span className="min-w-28 capitalize text-gray-600">{k.replace(/_/g, " ")}</span>
                  <span className="flex-1">{String(v)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {physical && (
          <div>
            <div className="text-sm font-semibold mb-1">Physical Exam</div>
            <div className="text-sm whitespace-pre-wrap">{String(physical)}</div>
          </div>
        )}
        {!vital && !physical && (
          <div className="text-sm whitespace-pre-wrap">{JSON.stringify(data, null, 2)}</div>
        )}
      </div>
    );
  }
  return <span className="whitespace-pre-wrap">{typeof data === "string" ? data : String(data)}</span>;
}

const SoapSummary: React.FC = () => {
  const { patientId = "", visitId = "" } = useParams();
  const navigate = useNavigate();
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

  if (loading) return <div className="p-4">Loading SOAP summary…</div>;
  if (error) return <div className="p-4 text-red-600">{error}</div>;
  if (!soap) return <div className="p-4">No data.</div>;

  const subj = (soap as any).soap?.subjective ?? soap.subjective;
  const obj = (soap as any).soap?.objective ?? soap.objective;
  const assess = (soap as any).soap?.assessment ?? soap.assessment;
  const plan = (soap as any).soap?.plan ?? soap.plan;

  return (
    <div className="max-w-4xl mx-auto p-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">SOAP Summary</h1>
        <p className="text-xs opacity-60">Patient: {patientId} · Visit: {visitId}</p>
        {soap.generated_at && (
          <p className="text-xs opacity-60">Generated: {new Date(soap.generated_at).toLocaleString()}</p>
        )}
      </div>

      <Block title="Subjective">{render(subj)}</Block>
      <Block title="Objective">{renderObjective(obj)}</Block>
      <Block title="Assessment">{render(assess)}</Block>
      <Block title="Plan">{render(plan)}</Block>

      <div className="flex gap-2 flex-wrap">
        <button onClick={() => navigate(-1)} className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300">
          Back
        </button>
        <button
          onClick={() => navigate(`/vitals/${patientId}/${visitId}`)}
          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
        >
          Fill Vitals Form
        </button>
      </div>
    </div>
  );
};

export default SoapSummary;

