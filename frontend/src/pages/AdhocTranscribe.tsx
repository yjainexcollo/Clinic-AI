import React, { useEffect, useRef, useState } from "react";
import { BACKEND_BASE_URL } from "../services/patientService";
import { TranscriptView } from "../components/TranscriptView";
import ActionPlanModal from "../components/ActionPlanModal";
import { FileText } from "lucide-react";

const AdhocTranscribe: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [transcript, setTranscript] = useState<string>("");
  const [status, setStatus] = useState<string>("");
  const [language, setLanguage] = useState<'en' | 'sp'>('en');
  const [loading, setLoading] = useState(false);
  const [recording, setRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [dialogue, setDialogue] = useState<Array<Record<string, string>>>([]);
  const [audioUrl, setAudioUrl] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [adhocId, setAdhocId] = useState<string>("");
  const recorderMimeRef = useRef<string>("");
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);
  const levelRef = useRef<number>(0);
  const [level, setLevel] = useState<number>(0);
  const animationRef = useRef<number | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [showActionPlanModal, setShowActionPlanModal] = useState(false);

  useEffect(() => () => {
    // cleanup
    try {
      mediaRecorderRef.current?.stream.getTracks().forEach(t => t.stop());
    } catch {}
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
    try { audioContextRef.current?.close(); } catch {}
    streamRef.current?.getTracks().forEach(t => t.stop());
    if (audioUrl) URL.revokeObjectURL(audioUrl);
  }, [audioUrl]);

  const beginVisualizer = (stream: MediaStream) => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = audioCtx as AudioContext;
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 2048;
      analyserRef.current = analyser;
      const source = audioCtx.createMediaStreamSource(stream);
      sourceNodeRef.current = source;
      source.connect(analyser);
      const dataArray = new Uint8Array(analyser.frequencyBinCount) as Uint8Array;
      dataArrayRef.current = dataArray;

      const tick = () => {
        if (!analyserRef.current || !dataArrayRef.current) return;
        analyserRef.current.getByteTimeDomainData(dataArrayRef.current as any);
        // Compute RMS over time-domain data
        let sumSquares = 0;
        for (let i = 0; i < dataArrayRef.current.length; i++) {
          const v = (dataArrayRef.current[i] - 128) / 128; // -1..1
          sumSquares += v * v;
        }
        const rms = Math.sqrt(sumSquares / dataArrayRef.current.length);
        // Smooth level
        levelRef.current = 0.8 * levelRef.current + 0.2 * rms;
        setLevel(levelRef.current);
        animationRef.current = requestAnimationFrame(tick);
      };
      animationRef.current = requestAnimationFrame(tick);
    } catch {}
  };

  const endVisualizer = async () => {
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
    animationRef.current = null;
    try { sourceNodeRef.current?.disconnect(); } catch {}
    sourceNodeRef.current = null;
    try { await audioContextRef.current?.close(); } catch {}
    audioContextRef.current = null;
    analyserRef.current = null;
    dataArrayRef.current = null;
    levelRef.current = 0;
    setLevel(0);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      // Pick a Safari-friendly MIME type when available
      const mimeCandidates = [
        'audio/mp4;codecs=mp4a.40.2',
        'audio/mp4',
        'audio/webm;codecs=opus',
        'audio/webm'
      ];
      let chosenMime = "";
      for (const m of mimeCandidates) {
        try {
          if ((window as any).MediaRecorder && (MediaRecorder as any).isTypeSupported && MediaRecorder.isTypeSupported(m)) {
            chosenMime = m; break;
          }
        } catch {}
      }
      const mediaRecorder = chosenMime ? new MediaRecorder(stream, { mimeType: chosenMime }) : new MediaRecorder(stream);
      recorderMimeRef.current = chosenMime;
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      mediaRecorder.onstop = async () => {
        const container = recorderMimeRef.current.includes('mp4') ? 'audio/mp4' : 'audio/webm';
        const ext = recorderMimeRef.current.includes('mp4') ? 'm4a' : 'webm';
        const blob = new Blob(chunksRef.current, { type: container });
        const recordedFile = new File([blob], `recording_${Date.now()}.${ext}`, { type: container });
        setFile(recordedFile);
        try { if (audioUrl) URL.revokeObjectURL(audioUrl); } catch {}
        setAudioUrl(URL.createObjectURL(blob));
        await endVisualizer();
      };
      mediaRecorder.start();
      setRecording(true);
      setStatus("Recording… click Stop when done.");
      beginVisualizer(stream);
    } catch (e: any) {
      setStatus(e?.message || "Microphone access failed");
    }
  };

  const stopRecording = () => {
    const rec = mediaRecorderRef.current;
    if (rec && rec.state !== "inactive") {
      rec.stop();
      try { rec.stream.getTracks().forEach((t) => t.stop()); } catch {}
      setRecording(false);
      setStatus("Recording stopped. You can upload now.");
    }
  };

  const upload = async () => {
    if (!file) return;
    setLoading(true);
    setUploading(true);
    setTranscript("");
    setStatus("");
    setDialogue([]);
    try {
      // Upload audio to ad-hoc transcription endpoint (no patient/visit)
      setStatus("Uploading audio for transcription…");
      console.log("Uploading file:", file?.name, "size:", file?.size, "type:", file?.type);
      
      const form = new FormData();
      form.append("audio_file", file);
      form.append('language', language);
      
      console.log("Form data entries:");
      for (let [key, value] of form.entries()) {
        console.log(key, value);
      }
      
      const res = await fetch(`${BACKEND_BASE_URL}/transcription`, {
        method: "POST",
        body: form,
      });
      
      console.log("Response status:", res.status, res.statusText);
      
      if (!res.ok) {
        let msg = `Transcription failed ${res.status}`;
        try {
          const j = await res.json();
          console.log("Error response:", j);
          if (j?.detail) {
            if (typeof j.detail === 'string') msg += `: ${j.detail}`;
            else if (j.detail?.message) msg += `: ${j.detail.message}`;
            else msg += `: ${JSON.stringify(j.detail)}`;
          }
        } catch {
          try { 
            const text = await res.text();
            console.log("Error text:", text);
            msg += `: ${text}`; 
          } catch {}
        }
        throw new Error(msg);
      }
      const data = await res.json();
      const text = data?.transcript || "";
      const receivedAdhocId = data?.adhoc_id as string | undefined;
      
      setTranscript(text);
      setAdhocId(receivedAdhocId || "");

      // Structure dialogue via ad-hoc structure endpoint
      if (text) {
        setStatus("Structuring dialogue…");
        try {
          console.log("Calling structure endpoint with adhoc_id:", receivedAdhocId);
          const sres = await fetch(`${BACKEND_BASE_URL}/transcription/structure`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ transcript: text, adhoc_id: receivedAdhocId }),
          });
          console.log("Structure endpoint response status:", sres.status);
          if (sres.ok) {
            const sdata = await sres.json();
            console.log("Structure endpoint response data:", sdata);
            const dlg = sdata?.dialogue;
            if (Array.isArray(dlg)) {
              console.log("Setting dialogue with", dlg.length, "turns");
              setDialogue(dlg);
            } else {
              console.log("No valid dialogue array in response");
            }
          } else {
            console.error("Structure endpoint failed:", sres.status, await sres.text());
          }
        } catch (error) {
          console.error("Structure endpoint error:", error);
        }
      }
      setStatus("Completed.");
    } catch (e: any) {
      setStatus(e?.message || "Upload failed");
    } finally {
      setLoading(false);
      setUploading(false);
    }
  };

  const cancel = () => {
    // stop recording if active
    try { if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") mediaRecorderRef.current.stop(); } catch {}
    try { mediaRecorderRef.current?.stream.getTracks().forEach(t => t.stop()); } catch {}
    setRecording(false);
    setStatus("Cancelled.");
    // clear current file and preview
    setFile(null);
    try { if (audioUrl) URL.revokeObjectURL(audioUrl); } catch {}
    setAudioUrl("");
    setTranscript("");
    setDialogue([]);
  };

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Ad-hoc Transcription</h1>
      <p className="text-sm text-gray-600 mb-6">Upload or record audio</p>

      <div className="bg-white p-6 rounded-lg border border-gray-200 space-y-4">
        <div className="space-y-2">
          <label className="block text-sm font-medium">Language</label>
          <select value={language} onChange={(e) => setLanguage((e.target.value as any) || 'en')} className="px-3 py-2 border rounded">
            <option value="en">English</option>
            <option value="sp">Spanish</option>
          </select>
        </div>
        <div className="space-y-2">
          <label className="block text-sm font-medium">Select audio file</label>
          <input type="file" accept="audio/*,audio/mp4,.m4a,video/mpeg,video/mp4,.mp4,.mpeg,.mpg" onChange={(e) => setFile(e.target.files?.[0] || null)} />
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium">Or record</label>
          <div className="flex gap-3">
            {!recording ? (
              <button onClick={startRecording} className="px-4 py-2 bg-blue-600 text-white rounded">Start Recording</button>
            ) : (
              <button onClick={stopRecording} className="px-4 py-2 bg-red-600 text-white rounded">Stop</button>
            )}
          </div>
          {/* Live audio level visualizer */}
          <div className="h-3 w-full bg-gray-200 rounded overflow-hidden">
            <div
              className="h-full bg-green-500 transition-[width]"
              style={{ width: `${Math.min(100, Math.max(0, Math.round(level * 100)))}%` }}
            />
          </div>
          {/* Playback of recorded audio (if any) */}
          {audioUrl && (
            <div className="pt-2">
              <audio controls src={audioUrl} className="w-full" playsInline preload="metadata" />
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <button
            disabled={!file || loading}
            onClick={upload}
            className="px-4 py-2 bg-green-600 text-white rounded disabled:opacity-50"
          >
            {loading ? "Uploading…" : "Transcribe"}
          </button>
          <button
            type="button"
            onClick={cancel}
            disabled={uploading || recording || (!file && !audioUrl)}
            className="px-4 py-2 bg-gray-200 text-gray-800 rounded disabled:opacity-50"
          >
            Cancel
          </button>
        </div>

        {status && <div className="text-sm text-gray-800">{status}</div>}

        <div>
           {/* Action & Plan Button - Show only after transcript is generated */}
           {adhocId && dialogue.length > 0 && (
            <button
              onClick={() => setShowActionPlanModal(true)}
              className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              <FileText className="w-4 h-4" />
              <span>Generate Action & Plan</span>
            </button>
          )}
        </div>

        {dialogue.length > 0 ? (
          <TranscriptView content={JSON.stringify(dialogue)} />
        ) : (
          transcript && (
            <div>
              <div className="text-sm font-semibold mb-1">Transcript</div>
              <div className="text-sm whitespace-pre-wrap bg-gray-50 p-3 rounded border">{transcript}</div>
              
              {/* Audio Storage Status */}
              {adhocId && (
                <div className="mt-3">
                  <div className="text-xs text-gray-500">
                    Audio file stored in database (ID: {adhocId})
                  </div>
                </div>
              )}
            </div>
          )
        )}
      </div>

      {/* Action Plan Modal */}
      {showActionPlanModal && adhocId && (
        <ActionPlanModal
          isOpen={showActionPlanModal}
          onClose={() => setShowActionPlanModal(false)}
          adhocId={adhocId}
        />
      )}
    </div>
  );
};

export default AdhocTranscribe;


