import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { BACKEND_BASE_URL } from "../services/patientService";

const TranscriptUpload: React.FC = () => {
  const { patientId = "", visitId = "" } = useParams();
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const upload = async () => {
    if (!file || !patientId || !visitId) return;
    setLoading(true);
    setStatus("");
    try {
      const form = new FormData();
      form.append("patient_id", patientId);
      form.append("visit_id", visitId);
      form.append("audio_file", file);
      const res = await fetch(`${BACKEND_BASE_URL}/notes/transcribe`, {
        method: "POST",
        body: form,
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(`Transcribe failed ${res.status}: ${t}`);
      }
      setStatus("Queued. Polling transcript status…");
      pollStatus();
    } catch (e: any) {
      setStatus(e?.message || "Upload failed");
    } finally {
      setLoading(false);
    }
  };

  const pollStatus = async (attempt = 0) => {
    try {
      const res = await fetch(`${BACKEND_BASE_URL}/notes/${encodeURIComponent(patientId)}/visits/${encodeURIComponent(visitId)}/transcript`, {
        headers: { Accept: "application/json" },
      });
      if (res.status === 202) {
        const delay = Math.min(10000, 1000 * Math.pow(1.5, attempt));
        setTimeout(() => pollStatus(attempt + 1), delay);
        return;
      }
      if (!res.ok) {
        const t = await res.text();
        throw new Error(`Status failed ${res.status}: ${t}`);
      }
      const data = await res.json();
      if (data?.transcription_status === "completed" && data?.transcript) {
        setStatus("Transcription completed.");
      } else if (data?.transcription_status === "failed") {
        setStatus(`Transcription failed: ${data?.error_message || "Unknown error"}`);
      } else {
        const delay = Math.min(10000, 1000 * Math.pow(1.5, attempt));
        setTimeout(() => pollStatus(attempt + 1), delay);
      }
    } catch (e: any) {
      setStatus(e?.message || "Polling failed");
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-4">Upload Audio for Transcription</h1>
      <p className="text-sm text-gray-600 mb-6">Patient: {patientId} • Visit: {visitId}</p>
      <div className="bg-white p-6 rounded-lg border border-gray-200 space-y-4">
        <input
          type="file"
          accept="audio/*"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
        />
        <div className="flex gap-3">
          <button
            disabled={!file || loading}
            onClick={upload}
            className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
          >
            {loading ? "Uploading…" : "Upload & Transcribe"}
          </button>
          <button
            onClick={() => navigate(`/soap/${encodeURIComponent(patientId)}/${encodeURIComponent(visitId)}`)}
            className="px-4 py-2 border rounded"
          >
            View SOAP
          </button>
        </div>
        {status && <div className="text-sm text-gray-800">{status}</div>}
      </div>
    </div>
  );
};

export default TranscriptUpload;


