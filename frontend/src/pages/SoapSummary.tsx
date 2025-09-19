import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getSoapNote, SoapNoteResponse } from "../services/patientService";

const Section: React.FC<{ title: string; children?: React.ReactNode }>=({ title, children })=>{
  return (
    <div className="mb-6">
      <h2 className="text-lg font-semibold mb-2">{title}</h2>
      <div className="whitespace-pre-wrap text-sm leading-6 bg-white/60 rounded-md p-3 border">
        {children || <span className="opacity-60">Not discussed</span>}
      </div>
    </div>
  );
};

const SoapSummary: React.FC = () => {
  const { patientId = "", visitId = "" } = useParams();
  const [data, setData] = useState<SoapNoteResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    let alive = true;
    async function run() {
      try {
        setLoading(true);
        const resp = await getSoapNote(patientId, visitId);
        if (!alive) return;
        setData(resp);
      } catch (e: any) {
        if (!alive) return;
        setError(e?.message || "Failed to load SOAP note");
      } finally {
        if (alive) setLoading(false);
      }
    }
    if (patientId && visitId) run();
    return () => { alive = false; };
  }, [patientId, visitId]);

  if (loading) {
    return <div className="p-4">Loading SOAP summary…</div>;
  }
  if (error) {
    return <div className="p-4 text-red-600">{error}</div>;
  }
  if (!data) {
    return <div className="p-4">No data.</div>;
  }

  return (
    <div className="max-w-4xl mx-auto p-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">SOAP Summary</h1>
        <p className="text-xs opacity-60">Patient: {patientId} · Visit: {visitId}</p>
        {data.generated_at && (
          <p className="text-xs opacity-60">Generated: {new Date(data.generated_at).toLocaleString()}</p>
        )}
      </div>

      <Section title="Subjective">
        {typeof data.subjective === 'string' ? data.subjective : JSON.stringify(data.subjective, null, 2)}
      </Section>
      <Section title="Objective">
        {typeof data.objective === 'string' ? data.objective : JSON.stringify(data.objective, null, 2)}
      </Section>
      <Section title="Assessment">
        {typeof data.assessment === 'string' ? data.assessment : JSON.stringify(data.assessment, null, 2)}
      </Section>
      <Section title="Plan">
        {typeof data.plan === 'string' ? data.plan : JSON.stringify(data.plan, null, 2)}
      </Section>

      {(data.highlights?.length || 0) > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-2">Highlights</h2>
          <ul className="list-disc pl-6 text-sm">
            {(data.highlights || []).map((h, i) => (
              <li key={i}>{h}</li>
            ))}
          </ul>
        </div>
      )}

      {(data.red_flags?.length || 0) > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-2">Red Flags</h2>
          <ul className="list-disc pl-6 text-sm text-red-700">
            {(data.red_flags || []).map((h, i) => (
              <li key={i}>{h}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="text-xs opacity-60">
        {data.model_info && (<pre className="overflow-auto">{JSON.stringify(data.model_info, null, 2)}</pre>)}
        {typeof data.confidence_score === 'number' && (
          <p>Confidence: {Math.round(data.confidence_score * 100)}%</p>
        )}
      </div>
    </div>
  );
};

export default SoapSummary;


