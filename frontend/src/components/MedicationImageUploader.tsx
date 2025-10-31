import React, { useEffect, useRef, useState } from "react";
import { BACKEND_BASE_URL } from "../services/patientService";

interface Props {
  patientId: string;
  visitId: string;
  title?: string;
  onChange?: () => void;
}

type ServerImage = { id: string; filename: string; content_type?: string };

type QueuedImage = { id: string; file: File; previewUrl: string };

const MedicationImageUploader: React.FC<Props> = ({ patientId, visitId, title = "What medications do you take? (upload images, optional)", onChange }) => {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string>("");
  const [successMsg, setSuccessMsg] = useState<string>("");
  const [elapsed, setElapsed] = useState<number>(0);
  const [images, setImages] = useState<ServerImage[]>([]);
  const [queue, setQueue] = useState<QueuedImage[]>([]);
  const timerRef = useRef<number | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

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

  // Load existing uploaded images
  useEffect(() => {
    const load = async () => {
      try {
        const resp = await fetch(`${BACKEND_BASE_URL}/patients/${patientId}/visits/${visitId}/images`);
        if (!resp.ok) return;
        const data = await resp.json();
        setImages(Array.isArray(data?.images) ? data.images : []);
      } catch {}
    };
    if (patientId && visitId) load();
  }, [patientId, visitId]);

  const formatElapsed = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return m > 0 ? `${m}m ${sec.toString().padStart(2, '0')}s` : `${sec}s`;
  };

  const onPick = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    
    // Strict filtering: only allow specific image MIME types
    const allowedTypes = [
      'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 
      'image/heic', 'image/heif', 'image/gif', 'image/bmp'
    ];
    
    // Also check file extension as fallback (case-insensitive)
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif', '.gif', '.bmp'];
    
    // Track rejected files for better error message
    const rejectedFiles: string[] = [];
    
    const imageFiles = Array.from(files).filter(file => {
      const fileType = (file.type || '').toLowerCase().trim();
      const fileName = (file.name || '').toLowerCase();
      
      // Check if MIME type is in allowed list
      const hasValidMimeType = fileType && allowedTypes.includes(fileType);
      
      // Check if file extension is in allowed list
      const hasValidExtension = fileName && allowedExtensions.some(ext => fileName.endsWith(ext.toLowerCase()));
      
      // Only accept if MIME type matches allowed types (strict check)
      // OR if MIME type is empty/missing but extension is valid (fallback for OS that don't set MIME type)
      const isImage = hasValidMimeType || (hasValidExtension && (!fileType || fileType === ''));
      
      if (!isImage) {
        rejectedFiles.push(file.name);
      }
      return isImage;
    });
    
    // Show error if any files were rejected
    if (rejectedFiles.length > 0) {
      const fileList = rejectedFiles.length === 1 
        ? rejectedFiles[0] 
        : `${rejectedFiles.length} files`;
      setError(`${fileList} rejected. Only image files (JPEG, PNG, WEBP, HEIC, GIF, BMP) are allowed.`);
      setTimeout(() => setError(""), 5000);
    }
    
    if (imageFiles.length === 0) {
      // Clear the input so user can try again
      if (inputRef.current) {
        inputRef.current.value = '';
      }
      return;
    }
    
    // Stage locally; will be uploaded with the answer submission
    const newItems: QueuedImage[] = imageFiles.map((file) => ({
      id: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2)}`,
      file,
      previewUrl: URL.createObjectURL(file),
    }));
    const next = [...queue, ...newItems];
    setQueue(next);
    ;(window as any).clinicaiMedicationFiles = next.map(q => q.file);
    if (onChange) onChange();
  };

  const clearQueuePreviews = () => {
    queue.forEach((q) => URL.revokeObjectURL(q.previewUrl));
  };

  const uploadQueued = async () => {
    if (queue.length === 0) return;
    setError("");
    setSuccessMsg("");
    setIsUploading(true);
    try {
      const form = new FormData();
      queue.forEach((q) => {
        form.append("images", q.file);
      });
      form.append("patient_id", patientId);
      form.append("visit_id", visitId);

      const resp = await fetch(`${BACKEND_BASE_URL}/patients/webhook/images`, {
        method: "POST",
        body: form,
      });
      if (!resp.ok) {
        const txt = await resp.text();
        throw new Error(`Upload failed ${resp.status}: ${txt}`);
      }
      const result = await resp.json();
      if (Array.isArray(result?.uploaded_images)) {
        setImages((prev) => [
          ...prev,
          ...result.uploaded_images.map((x: any) => ({ id: x.id, filename: x.filename, content_type: x.content_type }))
        ]);
      }
      setSuccessMsg(`Uploaded ${queue.length} image(s)`);
      window.setTimeout(() => setSuccessMsg(""), 2000);
      // Reset queue and input
      clearQueuePreviews();
      setQueue([]);
      if (inputRef.current) inputRef.current.value = "";
      if (onChange) onChange();
    } catch (e: any) {
      setError(e?.message || "Error uploading");
    } finally {
      setIsUploading(false);
    }
  };

  const removeQueued = (id: string) => {
    const item = queue.find((q) => q.id === id);
    if (item) URL.revokeObjectURL(item.previewUrl);
    const next = queue.filter((q) => q.id !== id);
    setQueue(next);
    ;(window as any).clinicaiMedicationFiles = next.map(q => q.file);
  };

  const removeImage = async (id: string) => {
    try {
      const resp = await fetch(`${BACKEND_BASE_URL}/patients/images/${id}`, { method: "DELETE" });
      if (!resp.ok) {
        const txt = await resp.text();
        throw new Error(`Delete failed ${resp.status}: ${txt}`);
      }
      setImages(prev => prev.filter(img => img.id !== id));
      if (onChange) onChange();
    } catch (e: any) {
      setError(e?.message || "Error deleting image");
    }
  };

  return (
    <div className="space-y-2">
      <label className="text-sm text-gray-700">{title}</label>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/webp,image/heic,image/heif,image/gif,image/bmp"
        multiple
        onChange={(e) => {
          if (e.target && e.target.files) {
            onPick(e.target.files);
          }
          // Clear input after processing to allow re-selection of same file
          // This also ensures validation runs on next selection
          setTimeout(() => {
            if (inputRef.current) {
              inputRef.current.value = '';
            }
          }, 100);
        }}
        className="block w-full text-sm text-gray-700"
      />

      {/* Queue previews with remove-before-upload */}
      {queue.length > 0 && (
        <div className="mt-2">
          <div className="text-xs text-gray-600 mb-2">Selected (will upload when you submit your answer):</div>
          <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
            {queue.map((q) => (
              <div key={q.id} className="relative group border rounded p-1 bg-gray-50">
                <img src={q.previewUrl} alt={q.file.name} className="w-full h-24 object-cover rounded" />
                <button
                  type="button"
                  onClick={(e) => { e.preventDefault(); removeQueued(q.id); }}
                  className="absolute top-1 right-1 text-[11px] px-1.5 py-0.5 bg-red-600 text-white rounded opacity-90 group-hover:opacity-100"
                >
                  Remove
                </button>
                <div className="text-[11px] text-gray-600 mt-1 truncate" title={q.file.name}>{q.file.name}</div>
              </div>
            ))}
          </div>
          <div className="flex justify-end mt-2">
            <button
              type="button"
              onClick={uploadQueued}
              disabled={isUploading}
              className="px-3 py-1.5 rounded bg-blue-600 text-white text-sm disabled:opacity-60"
            >
              {isUploading ? `Uploading... ${formatElapsed(elapsed)}` : `Upload ${queue.length} image(s)`}
            </button>
          </div>
        </div>
      )}

      {isUploading && queue.length === 0 && (
        <div className="text-blue-600 text-sm">Uploading... {formatElapsed(elapsed)}</div>
      )}
      {successMsg && <div className="text-green-600 text-sm">{successMsg}</div>}
      {error && <div className="text-red-600 text-sm">{error}</div>}
      
      {images.length > 0 && (
        <div className="mt-2">
          <div className="text-xs text-gray-600 mb-1">Uploaded images:</div>
          <div className="space-y-1">
            {images.map((img) => (
              <div key={img.id} className="flex items-center justify-between bg-gray-50 p-2 rounded text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <img
                    src={`${BACKEND_BASE_URL}/patients/${patientId}/visits/${visitId}/intake-images/${img.id}/content`}
                    alt={img.filename}
                    className="w-8 h-8 object-cover rounded border"
                  />
                  <span className="text-gray-700 truncate max-w-[180px]" title={img.filename}>{img.filename}</span>
                </div>
                <button
                  type="button"
                  onClick={(e) => { e.preventDefault(); removeImage(img.id); }}
                  className="text-red-500 hover:text-red-700"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
      
      <div className="text-xs text-gray-500">You can select multiple images at once.</div>
    </div>
  );
};

export default MedicationImageUploader;