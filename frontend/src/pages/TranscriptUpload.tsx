import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { BACKEND_BASE_URL } from "../services/patientService";
import { workflowService } from "../services/workflowService";

const TranscriptUpload: React.FC = () => {
  const { patientId = "", visitId = "" } = useParams();
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [workflowType, setWorkflowType] = useState<string>("scheduled");
  const [availableSteps, setAvailableSteps] = useState<string[]>([]);
  
  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [audioChunks, setAudioChunks] = useState<Blob[]>([]);
  const [recordedAudio, setRecordedAudio] = useState<Blob | null>(null);
  const [recordingPermission, setRecordingPermission] = useState<boolean | null>(null);

  // Detect workflow type and available steps
  useEffect(() => {
    const fetchWorkflowInfo = async () => {
      if (!visitId) return;
      
      try {
        const stepsResponse = await workflowService.getAvailableSteps(visitId);
        setAvailableSteps(stepsResponse.available_steps);
        
        // Determine workflow type based on available steps
        if (stepsResponse.available_steps.includes("vitals")) {
          setWorkflowType("walk_in");
        } else {
          setWorkflowType("scheduled");
        }
      } catch (error) {
        console.error("Error fetching workflow info:", error);
        // Default to scheduled if we can't determine
        setWorkflowType("scheduled");
      }
    };

    fetchWorkflowInfo();
  }, [visitId]);

  // Recording functionality
  const requestRecordingPermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setRecordingPermission(true);
      stream.getTracks().forEach(track => track.stop()); // Stop the stream immediately
      return true;
    } catch (error) {
      console.error("Error requesting recording permission:", error);
      setRecordingPermission(false);
      setError("Microphone access denied. Please allow microphone access to record audio.");
      return false;
    }
  };

  const startRecording = async () => {
    if (recordingPermission === null) {
      const hasPermission = await requestRecordingPermission();
      if (!hasPermission) return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      
      setAudioChunks([]);
      setRecordedAudio(null);
      setRecordingTime(0);
      
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          setAudioChunks(prev => [...prev, event.data]);
        }
      };

      recorder.onstop = () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        setRecordedAudio(audioBlob);
        setFile(new File([audioBlob], 'recording.webm', { type: 'audio/webm' }));
        stream.getTracks().forEach(track => track.stop());
      };

      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
      
      // Start recording timer
      const timer = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
      
      // Store timer reference for cleanup
      (recorder as any).timer = timer;
      
    } catch (error) {
      console.error("Error starting recording:", error);
      setError("Failed to start recording. Please check your microphone permissions.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
      setIsRecording(false);
      
      // Clear timer
      if ((mediaRecorder as any).timer) {
        clearInterval((mediaRecorder as any).timer);
      }
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

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
        
        // Refresh available steps after transcription completion
        try {
          const stepsResponse = await workflowService.getAvailableSteps(visitId);
          setAvailableSteps(stepsResponse.available_steps);
        } catch (error) {
          console.error("Error refreshing workflow steps:", error);
        }
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
      <p className="text-sm text-gray-600 mb-2">Patient: {patientId} • Visit: {visitId}</p>
      <div className="mb-6">
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
          workflowType === "walk_in" 
            ? "bg-green-100 text-green-800" 
            : "bg-blue-100 text-blue-800"
        }`}>
          {workflowType === "walk_in" ? "Walk-in Workflow" : "Scheduled Workflow"}
        </span>
      </div>
      <div className="bg-white p-6 rounded-lg border border-gray-200 space-y-6">
        {/* File Upload Section */}
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-3">Upload Audio File</h3>
          <input
            type="file"
            accept="audio/*,.mp3,.mpeg,.mp4,.wav,.m4a,.aac,.ogg,.flac,.wma"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {file && (
            <p className="mt-2 text-sm text-gray-600">
              Selected: {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
            </p>
          )}
        </div>

        {/* Divider */}
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-300" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-white text-gray-500">OR</span>
          </div>
        </div>

        {/* Live Recording Section */}
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-3">Record Audio Live</h3>
          
          {/* Recording Controls */}
          <div className="flex items-center gap-4 mb-4">
            {!isRecording ? (
              <button
                onClick={startRecording}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                </svg>
                Start Recording
              </button>
            ) : (
              <button
                onClick={stopRecording}
                className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1zM12 7a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                Stop Recording
              </button>
            )}
            
            {/* Recording Timer */}
            {isRecording && (
              <div className="flex items-center gap-2 text-red-600">
                <div className="w-3 h-3 bg-red-600 rounded-full animate-pulse"></div>
                <span className="font-mono text-lg">{formatTime(recordingTime)}</span>
              </div>
            )}
          </div>

          {/* Recording Status */}
          {isRecording && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-800">
                <strong>Recording in progress...</strong> Speak clearly into your microphone.
              </p>
            </div>
          )}

          {/* Recorded Audio Preview */}
          {recordedAudio && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-md">
              <p className="text-sm text-green-800 mb-2">
                <strong>Recording completed!</strong> Duration: {formatTime(recordingTime)}
              </p>
              <audio controls className="w-full">
                <source src={URL.createObjectURL(recordedAudio)} type="audio/webm" />
                Your browser does not support the audio element.
              </audio>
            </div>
          )}

          {/* Recording Permission Status */}
          {recordingPermission === false && (
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
              <p className="text-sm text-yellow-800">
                <strong>Microphone access required:</strong> Please allow microphone access to record audio.
              </p>
            </div>
          )}
        </div>
        {/* Upload Button */}
        <div className="flex gap-3">
          <button
            disabled={!file || loading}
            onClick={upload}
            className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            {loading ? "Uploading & Transcribing..." : "Upload & Transcribe"}
          </button>
          
          {/* Show different buttons based on workflow type and available steps */}
          {workflowType === "walk_in" && availableSteps.includes("vitals") && (
            <button
              onClick={() => navigate(`/walk-in-vitals/${encodeURIComponent(patientId)}/${encodeURIComponent(visitId)}`)}
              className="px-4 py-2 border rounded"
            >
              Next: Vitals Form
            </button>
          )}
          
          {workflowType === "scheduled" && availableSteps.includes("soap_generation") && (
            <button
              onClick={() => navigate(`/soap/${encodeURIComponent(patientId)}/${encodeURIComponent(visitId)}`)}
              className="px-4 py-2 border rounded"
            >
              View SOAP
            </button>
          )}
          
          {workflowType === "walk_in" && availableSteps.includes("soap_generation") && (
            <button
              onClick={() => navigate(`/walk-in-soap/${encodeURIComponent(patientId)}/${encodeURIComponent(visitId)}`)}
              className="px-4 py-2 border rounded"
            >
              View SOAP
            </button>
          )}
          
          {/* Structured Dialogue View Button - Show when transcription is completed */}
          {status === "Transcription completed." && (
            <button
              onClick={() => navigate(`/transcript-view/${encodeURIComponent(patientId)}/${encodeURIComponent(visitId)}`)}
              className="px-4 py-2 border rounded bg-gray-100 hover:bg-gray-200"
            >
              View Structured Dialogue
            </button>
          )}
        </div>
        
        {/* Error Message */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}
        
        {/* Status Message */}
        {status && <div className="text-sm text-gray-800">{status}</div>}
        
        {/* Workflow guidance */}
        {workflowType === "walk_in" && (
          <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-md">
            <p className="text-sm text-green-800">
              <strong>Walk-in Workflow:</strong> After transcription, you'll need to complete the Vitals Form before generating the SOAP note.
            </p>
          </div>
        )}
        
        {workflowType === "scheduled" && (
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
            <p className="text-sm text-blue-800">
              <strong>Scheduled Workflow:</strong> After transcription, you can proceed directly to SOAP generation.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default TranscriptUpload;


