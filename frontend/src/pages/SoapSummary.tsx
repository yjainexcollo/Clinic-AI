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
      <Block title="Objective">{render(obj)}</Block>
      <Block title="Assessment">{render(assess)}</Block>
      <Block title="Plan">{render(plan)}</Block>

      <div className="flex gap-2">
        <button onClick={() => navigate(-1)} className="px-4 py-2 bg-gray-200 rounded">Back</button>
        <button
          onClick={async () => {
            try {
              setLoading(true);
              await generateSoapNote(patientId, visitId);
              const s = await getSoapNote(patientId, visitId);
              setSoap(s);
              setError("");
            } catch (e: any) {
              setError(e?.message || "Failed to regenerate SOAP");
            } finally {
              setLoading(false);
            }
          }}
          className="px-4 py-2 bg-indigo-600 text-white rounded"
        >
          Regenerate
        </button>
      </div>
    </div>
  );
};

export default SoapSummary;


