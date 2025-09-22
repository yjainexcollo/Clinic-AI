import React, { useEffect, useRef, useState } from "react";
import { BACKEND_BASE_URL } from "../services/patientService";

interface Props {
  patientId: string;
  visitId: string;
}

const MedicationImageUploader: React.FC<Props> = ({ patientId, visitId }) => {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string>("");
  const [successMsg, setSuccessMsg] = useState<string>("");
  const [elapsed, setElapsed] = useState<number>(0);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (isUploading) {
      setElapsed(0);
      timerRef.current = window.setInterval(() => setElapsed((s) => s + 1), 1000);
    } else if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    return () => { if (timerRef.current) window.clearInterval(timerRef.current); };
  }, [isUploading]);

  const formatElapsed = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return m > 0 ? `${m}m ${sec.toString().padStart(2, '0')}s` : `${sec}s`;
  };

  const onPick = async (file: File | null) => {
    if (!file) return;
    setError("");
    setSuccessMsg("");
    setIsUploading(true);
    try {
      const form = new FormData();
      form.append("image", file);
      form.append("patient_id", patientId);
      form.append("visit_id", visitId);
      const resp = await fetch(`${BACKEND_BASE_URL}/patients/webhook/image`, {
        method: "POST",
        body: form,
      });
      if (!resp.ok) {
        const txt = await resp.text();
        throw new Error(`Upload failed ${resp.status}: ${txt}`);
      }
      setSuccessMsg("Upload complete");
    } catch (e: any) {
      setError(e?.message || "Error uploading");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-2">
      <label className="text-sm text-gray-700">Add prescription image (optional)</label>
      <input
        type="file"
        accept="image/*;capture=camera"
        onChange={(e) => onPick(e.target.files && e.target.files[0] ? e.target.files[0] : null)}
        className="block w-full text-sm text-gray-700"
      />
      {isUploading && (
        <div className="text-blue-600 text-sm">Uploading... {formatElapsed(elapsed)}</div>
      )}
      {successMsg && <div className="text-green-600 text-sm">{successMsg}</div>}
      {error && <div className="text-red-600 text-sm">{error}</div>}
      <div className="text-xs text-gray-500">You can upload multiple images one by one.</div>
    </div>
  );
};

export default MedicationImageUploader;


