import React, { useState, useEffect, useRef } from "react";
import { useParams, useLocation } from "react-router-dom";
import {
  answerIntakeBackend,
  editAnswerBackend,
  OCRQualityInfo,
  BACKEND_BASE_URL,
  uploadMedicationImages,
  authorizedFetch,
} from "../services/patientService";
import { SessionManager } from "../utils/session";
import { COPY } from "../copy";
import SymptomSelector from "../components/SymptomSelector";
import OCRQualityFeedback from "../components/OCRQualityFeedback";
import SummaryView from "../components/SummaryView";
import TranscriptView from "../components/TranscriptView";
import MedicationImageUploader from "../components/MedicationImageUploader";
import { LanguageToggle } from "../components/LanguageToggle";
import { useLanguage } from "../contexts/LanguageContext";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../components/ui/alert-dialog";

interface Question {
  text: string;
  answer: string;
}

const Index = () => {
  const { patientId } = useParams<{ patientId: string }>();
  const location = useLocation();
  const { language, setLanguage, t } = useLanguage();
  const [currentQuestion, setCurrentQuestion] = useState<string>("");
  const [currentAnswer, setCurrentAnswer] = useState<string>("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [isComplete, setIsComplete] = useState<boolean>(false);
  const [summary, setSummary] = useState<string>("");
  const [isInitialized, setIsInitialized] = useState<boolean>(false);
  const [retryCount, setRetryCount] = useState<number>(0);
  const [showStartScreen, setShowStartScreen] = useState<boolean>(true);
  const [visitId, setVisitId] = useState<string | null>(null);
  const [patientName, setPatientName] = useState<string | null>(null);
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const pendingNextQuestionRef = useRef<string>("");
  const [completionPercent, setCompletionPercent] = useState<number>(0);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [hasPostVisitSummary, setHasPostVisitSummary] = useState<boolean>(false);
  const [hasTranscript, setHasTranscript] = useState<boolean>(false);
  const [hasVitals, setHasVitals] = useState<boolean>(false);
  const [hasSoap, setHasSoap] = useState<boolean>(false);
  const [editingValue, setEditingValue] = useState<string>("");
  const [ocrQuality, setOcrQuality] = useState<OCRQualityInfo | null>(null);
  const [showOcrFeedback, setShowOcrFeedback] = useState<boolean>(false);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [showSummaryView, setShowSummaryView] = useState<boolean>(false);
  const [allowsImageUpload, setAllowsImageUpload] = useState<boolean>(false);
  const [showUploadAudio, setShowUploadAudio] = useState<boolean>(false);
  const [isTranscribingAudio, setIsTranscribingAudio] = useState<boolean>(false);
  const [uploadAudioError, setUploadAudioError] = useState<string>("");
  const [showTranscript, setShowTranscript] = useState<boolean>(false);
  const [transcriptText, setTranscriptText] = useState<string>("");
  const [isTranscriptLoading, setIsTranscriptLoading] = useState<boolean>(false);
  const [showTranscriptProcessing, setShowTranscriptProcessing] = useState<boolean>(false);
  const [transcriptProcessingStatus, setTranscriptProcessingStatus] = useState<string>("Processing transcript...");
  const [showPostVisitProcessing, setShowPostVisitProcessing] = useState<boolean>(false);
  const [isWalkInPatient, setIsWalkInPatient] = useState<boolean>(false);
  const [showRefreshWarning, setShowRefreshWarning] = useState<boolean>(false);
  const [isResettingSession, setIsResettingSession] = useState<boolean>(false);

  // Recording state
  const [recording, setRecording] = useState<boolean>(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [recordSeconds, setRecordSeconds] = useState<number>(0);
  const recordTimerRef = useRef<number | null>(null);

  const startRecording = async () => {
    try {
      setRecordedBlob(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      const chunks: BlobPart[] = [];
      mr.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunks.push(e.data); };
      mr.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        setRecordedBlob(blob);
        stream.getTracks().forEach(t => t.stop());
      };
      mr.start();
      setMediaRecorder(mr);
      setRecording(true);
      setRecordSeconds(0);
      if (recordTimerRef.current) window.clearInterval(recordTimerRef.current);
      recordTimerRef.current = window.setInterval(() => setRecordSeconds(s => s + 1), 1000);
    } catch (e) {
      alert('Microphone permission denied or unavailable.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
    setRecording(false);
    if (recordTimerRef.current) { window.clearInterval(recordTimerRef.current); recordTimerRef.current = null; }
  };

  const inputRef = useRef<HTMLInputElement>(null);
  const hasShownRefreshWarning = useRef<boolean>(false);

  // Detect hard refresh (page reload) when intake is in progress
  useEffect(() => {
    if (!patientId || !visitId || isComplete || hasShownRefreshWarning.current) return;
    
    // Check if this is a hard refresh (page reload)
    const navigationType = (performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming)?.type;
    const isHardRefresh = navigationType === 'reload';
    
    // Check if there are questions in progress
    const hasQuestionsInProgress = questions.length > 0 || currentQuestion.trim() !== "";
    
    if (isHardRefresh && hasQuestionsInProgress) {
      setShowRefreshWarning(true);
      hasShownRefreshWarning.current = true;
    }
  }, [patientId, visitId, questions, currentQuestion, isComplete]);

  // Reset intake session function
  const resetIntakeSession = async () => {
    if (!patientId || !visitId) return;
    
    setIsResettingSession(true);
    try {
      // Reset the intake session in backend
      const resetResponse = await authorizedFetch(`${BACKEND_BASE_URL}/patients/${encodeURIComponent(patientId)}/visits/${encodeURIComponent(visitId)}/intake/reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (!resetResponse.ok) {
        throw new Error('Failed to reset intake session');
      }
      
      // Clear local state
      setQuestions([]);
      setCurrentQuestion("");
      setCurrentAnswer("");
      setCompletionPercent(0);
      setIsComplete(false);
      setIsInitialized(false);
      
      // After reset, fetch the first question from registration or use fallback
      // Check if we have first_question stored from registration
      const storedFirstQuestion = localStorage.getItem(`first_question_${patientId}`);
      if (storedFirstQuestion) {
        setCurrentQuestion(storedFirstQuestion);
      } else {
        // Fallback to a default question (same as registration)
        const defaultQuestion = language === 'sp' 
          ? "¿Por qué ha venido hoy? ¿Cuál es la principal preocupación con la que necesita ayuda?"
          : "Why have you come in today? What is the main concern you want help with?";
        setCurrentQuestion(defaultQuestion);
      }
      
      // Also try to fetch intake status to see if backend has a pending question
      try {
        const statusResponse = await authorizedFetch(`${BACKEND_BASE_URL}/patients/${encodeURIComponent(patientId)}/visits/${encodeURIComponent(visitId)}/intake/status`, {
          method: 'GET',
          headers: { 'Accept': 'application/json' }
        });
        
        if (statusResponse.ok) {
          const statusData = await statusResponse.json();
          const data = statusData.data || statusData;
          
          // If backend has a pending question, use that instead
          if (data.pending_question && data.pending_question.trim()) {
            setCurrentQuestion(data.pending_question);
          }
        }
      } catch (statusError) {
        // If status fetch fails, continue with the stored/default question
        console.log('Could not fetch intake status, using stored/default question');
      }
      
      // Mark as initialized and hide start screen
      setIsInitialized(true);
      setShowStartScreen(false);
      setShowRefreshWarning(false);
    } catch (error) {
      console.error('Error resetting intake session:', error);
      setError('Failed to reset intake session. Please try again.');
    } finally {
      setIsResettingSession(false);
      setIsLoading(false);
    }
  };

  // Restore intake session from backend when page loads with patientId and visitId
  useEffect(() => {
    const restoreIntakeSession = async () => {
      if (!patientId) return;
      
      const params = new URLSearchParams(location.search);
      const v = params.get("v");
      const effectiveVisitId = v || localStorage.getItem(`visit_${patientId}`);
      
      if (!effectiveVisitId) return;
      
      // Don't restore if this is a hard refresh warning scenario (will be handled separately)
      if (hasShownRefreshWarning.current) return;
      
      try {
        const response = await authorizedFetch(`${BACKEND_BASE_URL}/patients/${encodeURIComponent(patientId)}/visits/${encodeURIComponent(effectiveVisitId)}/intake/status`, {
          method: 'GET',
          headers: { 'Accept': 'application/json' }
        });

        if (response.ok) {
          const json = await response.json();
          const data = json.data || json;

          // Only restore if there's an active intake session with questions
          if (data.intake_status === "in_progress" && data.questions_asked && data.questions_asked.length > 0) {
            // Restore questions and answers
            const restoredQuestions: Question[] = data.questions_asked.map((qa: any) => ({
              text: qa.question,
              answer: qa.answer
            }));
            setQuestions(restoredQuestions);

            // Restore pending question or use the one from URL
            const urlQuestion = params.get("q");
            if (data.pending_question && data.pending_question.trim()) {
              setCurrentQuestion(data.pending_question);
            } else if (urlQuestion && urlQuestion.trim()) {
              setCurrentQuestion(decodeURIComponent(urlQuestion));
            }

            // Restore completion status
            if (data.intake_status === "completed") {
              setIsComplete(true);
            }

            // Restore question count and completion percent
            setCompletionPercent(data.total_questions && data.max_questions
              ? Math.round((data.total_questions / data.max_questions) * 100)
              : 0);

            setVisitId(effectiveVisitId);
            setShowStartScreen(false);
            setIsInitialized(true);
            
            console.log(`[Index] Restored intake session: ${data.total_questions}/${data.max_questions} questions, pending: ${data.pending_question || 'none'}`);
            return; // Early return since we restored from backend
          }
        }
      } catch (e) {
        console.error('Error restoring intake session:', e);
        // Fall through to URL param handling
      }
    };

    restoreIntakeSession();
  }, [patientId, location.search]);

  // Check walk-in status from backend (source of truth) and URL params (fallback)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const walkin = params.get("walkin");
    const effectiveVisitId = visitId || (patientId ? localStorage.getItem(`visit_${patientId}`) : null);
    
    // Backend is the source of truth - always check backend first if we have a visitId
    if (effectiveVisitId) {
      const checkWorkflowType = async () => {
        try {
          const { workflowService } = await import("../services/workflowService");
          const stepsResponse = await workflowService.getAvailableSteps(effectiveVisitId);
          // Backend is the source of truth - use workflow_type from backend
          if (stepsResponse.workflow_type === "walk_in" || stepsResponse.workflow_type === "WALK_IN" || stepsResponse.workflow_type === "walk-in") {
            setIsWalkInPatient(true);
          } else if (stepsResponse.workflow_type === "scheduled" || stepsResponse.workflow_type === "SCHEDULED") {
            // Always set to false if backend says scheduled (trust backend over URL)
            setIsWalkInPatient(false);
          } else {
            // If workflow_type is not recognized, fall back to URL param
            setIsWalkInPatient(walkin === "true");
          }
        } catch (error) {
          console.error("Error checking workflow type:", error);
          // On error, fall back to URL param if available
          setIsWalkInPatient(walkin === "true");
        }
      };
      checkWorkflowType();
    } else {
      // If no visitId, use URL param as fallback
      setIsWalkInPatient(walkin === "true");
    }
  }, [location.search, visitId, patientId]);

  // On mount, if q is present in URL, show it immediately and cache visit id
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const q = params.get("q");
    const v = params.get("v");
    const done = params.get("done");
    const walkin = params.get("walkin");
    
    // Only handle URL params if we haven't already restored from backend
    // (The restore effect above runs first)
    if (isInitialized) return;
    
    if (q && q.trim()) {
      setCurrentQuestion(q);
      setShowStartScreen(false);
      setIsInitialized(true);
    }
    if (patientId && v) {
      localStorage.setItem(`visit_${patientId}`, v);
      setVisitId(v);
      // Skip welcome screen when coming from SOAP Summary (has visit ID)
      setShowStartScreen(false);
      setIsInitialized(true);
    }
    if (done === "1" || done === "true") {
      setIsComplete(true);
      setShowStartScreen(false);
    }
    
    // Check if this is a walk-in patient
    if (walkin === "true") {
      setIsWalkInPatient(true);
      // For walk-in patients, skip the intake form and go directly to tabs
      setIsComplete(true);
      setShowStartScreen(false);
      setIsInitialized(true);
    }
    
    if (patientId && !v) {
      const storedV = localStorage.getItem(`visit_${patientId}`);
      if (storedV) setVisitId(storedV);
    }
    if (patientId) {
      const storedName = localStorage.getItem(`patient_name_${patientId}`);
      if (storedName) setPatientName(storedName);
      // Don't pre-select symptoms - let user choose from scratch
    }
  }, [location.search, isInitialized]);

  // Also load visitId and patient name when patientId changes (e.g., direct navigation)
  useEffect(() => {
    if (!patientId) return;
    const storedV = localStorage.getItem(`visit_${patientId}`);
    if (storedV) setVisitId(storedV);
    const storedName = localStorage.getItem(`patient_name_${patientId}`);
    if (storedName) setPatientName(storedName);
  }, [patientId]);

  // Auto-focus input when question changes
  useEffect(() => {
    if (inputRef.current && currentQuestion && !isComplete) {
      inputRef.current.focus();
    }
  }, [currentQuestion, isComplete]);

  // Check if post-visit summary exists
  useEffect(() => {
    const checkPostVisitSummary = async () => {
      if (!patientId || !visitId || !isComplete) return;
      
      try {
        const response = await authorizedFetch(`${BACKEND_BASE_URL}/patients/${encodeURIComponent(patientId)}/visits/${encodeURIComponent(visitId)}/summary/postvisit`, {
          method: 'GET',
          headers: { 'Accept': 'application/json' }
        });
        setHasPostVisitSummary(response.ok);
      } catch (e) {
        setHasPostVisitSummary(false);
      }
    };

    if (patientId && visitId && isComplete) {
      checkPostVisitSummary();
    }
  }, [patientId, visitId, isComplete]);

  // Check if transcript exists
  useEffect(() => {
    const checkTranscript = async () => {
      if (!patientId || !visitId || !isComplete) return;
      
      // First check localStorage flag
      const transcriptKey = `transcript_done_${patientId}_${visitId}`;
      const localStorageFlag = localStorage.getItem(transcriptKey) === '1';
      
      if (localStorageFlag) {
        setHasTranscript(true);
        return;
      }
      
      // If no localStorage flag, check API
      try {
        const response = await authorizedFetch(`${BACKEND_BASE_URL}/notes/${encodeURIComponent(patientId)}/visits/${encodeURIComponent(visitId)}/transcript`, {
          method: 'GET',
          headers: { 'Accept': 'application/json' }
        });
        
        console.log(`Transcript check response: ${response.status} for patient ${patientId}, visit ${visitId}`);
        
        // Check for 202 (Still Processing) BEFORE trying to parse JSON
        // Backend returns empty body for 202, so we must handle it first
        if (response.status === 202) {
          // Still processing, keep checking (no JSON body to parse)
          console.log('Transcript still processing, will check again later');
          setHasTranscript(false);
        } else if (response.ok) {
          // Only parse JSON if status is OK (200) and not 202
          const responseData = await response.json();
          console.log('Transcript data:', responseData);
          // Extract data from ApiResponse wrapper
          const data = responseData.data || responseData;
          const hasApiTranscript = !!data.transcript || (!!data.structured_dialogue && Array.isArray(data.structured_dialogue) && data.structured_dialogue.length > 0);
          console.log(`Has transcript: ${hasApiTranscript}, transcript length: ${data.transcript?.length || 0}, dialogue turns: ${data.structured_dialogue?.length || 0}`);
          setHasTranscript(hasApiTranscript);
          // If API has transcript but no localStorage flag, set the flag
          if (hasApiTranscript) {
            localStorage.setItem(transcriptKey, '1');
          }
        } else {
          console.log(`Transcript check failed with status: ${response.status}`);
          setHasTranscript(false);
        }
      } catch (e) {
        console.error('Error checking transcript:', e);
        setHasTranscript(false);
      }
    };

    if (patientId && visitId && isComplete) {
      checkTranscript();
      
      // Set up periodic checking for transcript updates (every 5 seconds)
      const interval = setInterval(() => {
        if (!hasTranscript) { // Only check if we don't have transcript yet
          checkTranscript();
        }
      }, 5000);
      
      return () => clearInterval(interval);
    }
  }, [patientId, visitId, isComplete, hasTranscript]);

  // Check if vitals exist
  useEffect(() => {
    const checkVitals = async () => {
      if (!patientId || !visitId || !isComplete) return;
      
      // First check localStorage flag
      const vitalsKey = `vitals_done_${patientId}_${visitId}`;
      const localStorageFlag = localStorage.getItem(vitalsKey) === '1';
      
      if (localStorageFlag) {
        setHasVitals(true);
        return;
      }
      
      // If no localStorage flag, check API
      try {
        const response = await authorizedFetch(`${BACKEND_BASE_URL}/patients/${encodeURIComponent(patientId)}/visits/${encodeURIComponent(visitId)}/vitals`, {
          method: 'GET',
          headers: { 'Accept': 'application/json' }
        });
        if (response.ok) {
          const data = await response.json();
          const hasApiVitals = !!data.vitals && Object.keys(data.vitals).length > 0;
          setHasVitals(hasApiVitals);
          // If API has vitals but no localStorage flag, set the flag
          if (hasApiVitals) {
            localStorage.setItem(vitalsKey, '1');
          }
        } else {
          setHasVitals(false);
        }
      } catch (e) {
        setHasVitals(false);
      }
    };

    if (patientId && visitId && isComplete) {
      checkVitals();
    }
  }, [patientId, visitId, isComplete]);

  // Check if SOAP note exists
  useEffect(() => {
    const checkSoap = async () => {
      if (!patientId || !visitId || !isComplete) return;
      
      // First check localStorage flag
      const soapKey = `soap_done_${patientId}_${visitId}`;
      const localStorageFlag = localStorage.getItem(soapKey) === '1';
      
      if (localStorageFlag) {
        setHasSoap(true);
        return;
      }
      
      // If no localStorage flag, check API
      try {
        const response = await authorizedFetch(`${BACKEND_BASE_URL}/notes/${encodeURIComponent(patientId)}/visits/${encodeURIComponent(visitId)}/soap`, {
          method: 'GET',
          headers: { 'Accept': 'application/json' }
        });
        if (response.ok) {
          const responseData = await response.json();
          const data = responseData.data || responseData;
          const hasApiSoap = !!data && (data.subjective || data.assessment || data.plan);
          setHasSoap(hasApiSoap);
          // If API has SOAP but no localStorage flag, set the flag
          if (hasApiSoap) {
            localStorage.setItem(soapKey, '1');
          }
        } else {
          setHasSoap(false);
        }
      } catch (e) {
        setHasSoap(false);
      }
    };

    if (patientId && visitId && isComplete) {
      checkSoap();
    }
  }, [patientId, visitId, isComplete]);

  const initializeSession = async () => {
    try {
      setIsLoading(true);
      setError("");

      console.log("Initializing session with patient ID:", patientId);

      // NOTE: Removed n8n API calls - intake is now handled entirely by the backend FastAPI service
      // The backend generates the first question during patient registration, so no separate initialization is needed
      // If we have a question from URL params, it's already set. Otherwise, the first question comes from backend registration.
      
      setIsInitialized(true);
      setRetryCount(0); // Reset retry count on success
      setShowStartScreen(false); // Hide start screen after successful initialization
    } catch (err) {
      console.error("Initialize error:", err);
      const errorMessage =
        err instanceof Error ? err.message : COPY.errors.generic;
      setError(errorMessage);
      setRetryCount((prev) => prev + 1);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResponse = (response: { next_question?: string | null; summary?: string | null; completion_percent?: number; allows_image_upload?: boolean }) => {
    console.log("Backend response:", response);
    if (typeof response.completion_percent === "number") {
      setCompletionPercent(Math.max(0, Math.min(100, response.completion_percent)));
    }
    // This flag indicates whether the UPCOMING question allows image upload
    if (typeof (response as any).allows_image_upload === 'boolean') {
      setAllowsImageUpload((response as any).allows_image_upload);
    }
    if (response.next_question === "COMPLETE") {
      setIsComplete(true);
      setSummary(response.summary || "");
      setCurrentQuestion("");
      // Auto-open summary view which shows loader until ready
      setShowSummaryView(true);
    } else if (
      typeof response.next_question === "string" &&
      response.next_question.trim() !== ""
    ) {
      setCurrentQuestion(response.next_question);
      pendingNextQuestionRef.current = response.next_question;
      setCurrentAnswer("");
    } else {
      // Treat missing next question as completion signal; open summary loader
      setIsComplete(true);
      setCurrentQuestion("");
      setShowSummaryView(true);
    }
  };

  const handleNext = async (e: React.FormEvent) => {
    e.preventDefault();
    const isFirstQuestion = questions.length === 0;
    const effectiveVisitId = visitId || (patientId ? localStorage.getItem(`visit_${patientId}`) : null);
    if (!patientId || !effectiveVisitId) {
      setError("Missing visit info. Please go back to registration to start a new visit.");
      return;
    }

    // First question: use predefined symptoms if available/selected
    let answerToSend = currentAnswer.trim();
    if (isFirstQuestion) {
      if (selectedSymptoms.length === 0 && !answerToSend) return;
      if (selectedSymptoms.length > 0) {
        answerToSend = selectedSymptoms.join(", ");
        localStorage.setItem(`symptoms_${patientId}`, JSON.stringify(selectedSymptoms));
      }
    } else {
      if (!answerToSend) return;
    }

    try {
      setIsLoading(true);
      setError("");

      // Append current Q&A locally
      setQuestions((prev) => {
        const next = [...prev, { text: currentQuestion, answer: answerToSend }];
        return next;
      });

      // Use backend-provided flag to decide if image should be sent with this answer
      const fileInputEl = document.querySelector('input[type="file"]') as HTMLInputElement | null;
      const chosenFile = fileInputEl?.files && fileInputEl.files[0] ? fileInputEl.files[0] : undefined;
      const stagedFiles: File[] | undefined = allowsImageUpload ? ((window as any).clinicaiMedicationFiles as File[] | undefined) : undefined;
      const imageFile = undefined; // we prefer stagedFiles now
      // If we have staged images, hit the webhook route first so the images route is definitely called
      if (stagedFiles && stagedFiles.length) {
        try {
          await uploadMedicationImages(patientId, effectiveVisitId!, stagedFiles);
        } catch (e) {
          console.error("Image upload failed:", e);
          // Continue with answer submission even if images failed, but keep user informed
        }
      }

      const response = await answerIntakeBackend({
        patient_id: patientId,
        visit_id: effectiveVisitId!,
        answer: answerToSend,
      }, imageFile, stagedFiles && stagedFiles.length ? stagedFiles : undefined);
      // Clear the temp file reference after sending
      (window as any).clinicaiMedicationFiles = undefined;
      if (response && typeof response.max_questions === "number") {
        localStorage.setItem(`maxq_${effectiveVisitId}`, String(response.max_questions));
      }
      console.log("Received response from backend:", response);
      
      // Handle OCR quality feedback if present
      if (response.ocr_quality) {
        setOcrQuality(response.ocr_quality);
        setShowOcrFeedback(true);
        // Don't proceed to next question yet - wait for user to review OCR quality
        return;
      }
      
      handleResponse({
        next_question: response.next_question || "",
        summary: undefined,
        completion_percent: response.completion_percent,
        allows_image_upload: response.allows_image_upload,
      });
    } catch (err) {
      console.error("Submit error:", err);
      setError(err instanceof Error ? err.message : COPY.errors.generic);
    } finally {
      setIsLoading(false);
    }
  };


  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !isLoading) {
      handleNext(e);
    }
  };

  const handleOcrReupload = () => {
    setShowOcrFeedback(false);
    setOcrQuality(null);
    // Clear the current file input to allow re-upload
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
    }
    (window as any).clinicaiMedicationFile = null;
  };

  const handleOcrProceed = async () => {
    setShowOcrFeedback(false);
    setOcrQuality(null);
    
    // Proceed with the current answer and continue to next question
    try {
      setIsLoading(true);
      const effectiveVisitId = visitId || (patientId ? localStorage.getItem(`visit_${patientId}`) : null);
      if (!patientId || !effectiveVisitId) return;

      const response = await answerIntakeBackend({
        patient_id: patientId,
        visit_id: effectiveVisitId,
        answer: currentAnswer.trim(),
      });
      
      handleResponse({
        next_question: response.next_question || "",
        summary: undefined,
        completion_percent: response.completion_percent,
      });
    } catch (err) {
      console.error("Proceed error:", err);
      setError(err instanceof Error ? err.message : COPY.errors.generic);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartNew = () => {
    SessionManager.clearSession();
    window.location.reload();
  };

  const currentQuestionNumber = questions.length + 1;
  // Dynamic progress: use backend-provided max when available via localStorage, fallback to 10
  const storedMax = (() => {
    if (!patientId) return null;
    const v = localStorage.getItem(`visit_${patientId}`);
    const k = v ? `maxq_${v}` : null;
    if (!k) return null;
    const n = localStorage.getItem(k);
    return n ? Number(n) : null;
  })();
  const totalEstimatedQuestions = storedMax && storedMax > 0 ? storedMax : 10;
  const progressPct = Math.min(
    Math.round(((questions.length) / totalEstimatedQuestions) * 100),
    100
  );

  // Show start screen if not initialized and not loading, and no visit ID (not coming from SOAP Summary)
  if (showStartScreen && !isLoading && !visitId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-medical-primary-light to-gray-50 flex items-center justify-center p-4">
        <div className="medical-card max-w-md w-full text-center">
          <div className="mb-8">
            <div className="w-20 h-20 bg-medical-primary rounded-full flex items-center justify-center mx-auto mb-6">
              <svg
                className="w-10 h-10 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Welcome to {COPY.app.title}
            </h2>
            
            <p className="text-gray-600 mb-6 leading-relaxed">
              Our AI assistant will guide you through a comprehensive medical
              intake interview. This will help us understand your health
              concerns and prepare for your visit.
            </p>
            {patientId && (() => {
              const symptomsData = localStorage.getItem(`symptoms_${patientId}`);
              if (symptomsData) {
                let symptoms;
                try {
                  symptoms = JSON.parse(symptomsData);
                } catch (e) {
                  symptoms = symptomsData;
                }
                return (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                    <h3 className="font-semibold text-blue-800 mb-2">
                      Your Reported Symptoms:
                    </h3>
                    <div className="text-blue-700 text-sm">
                      {Array.isArray(symptoms) ? (
                        <div className="flex flex-wrap gap-2">
                          {symptoms.map((symptom, index) => (
                            <span
                              key={index}
                              className="inline-block px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs"
                            >
                              {symptom}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p>{symptoms}</p>
                      )}
                    </div>
                  </div>
                );
              }
              return null;
            })()}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <h3 className="font-semibold text-blue-800 mb-2">
                What to expect:
              </h3>
              <ul className="text-blue-700 text-sm space-y-1 text-left">
                <li>• Personalized questions about your health</li>
                <li>• Secure and confidential information</li>
                <li>• Takes about 5-10 minutes to complete</li>
                <li>• Summary sent to your healthcare provider</li>
              </ul>
            </div>
          </div>

          <button
            onClick={initializeSession}
            disabled={isLoading}
            className="medical-button w-full flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Initializing...
              </>
            ) : (
              <>
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 7l5 5m0 0l-5 5m5-5H6"
                  />
                </svg>
                Start Intake Interview
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  if (!isInitialized && isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-medical-primary-light to-gray-50 flex items-center justify-center p-4">
        <div className="medical-card max-w-md w-full text-center">
          <div className="animate-spin-slow w-8 h-8 border-3 border-medical-primary border-t-transparent rounded-full mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">
            {COPY.app.title}
          </h2>
          <p className="text-gray-600">Initializing your intake session...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Refresh Warning Dialog */}
      <AlertDialog open={showRefreshWarning} onOpenChange={setShowRefreshWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {language === 'sp' ? '⚠️ Advertencia de Actualización' : '⚠️ Refresh Warning'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {language === 'sp' 
                ? 'Si continúa con la actualización, todos sus datos de admisión se perderán y el formulario comenzará desde el principio. ¿Está seguro de que desea continuar?'
                : 'If you continue with refresh, all your intake data will be lost and the form will start from the beginning. Are you sure you want to continue?'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowRefreshWarning(false)}>
              {language === 'sp' ? 'Cancelar' : 'Cancel'}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={resetIntakeSession}
              disabled={isResettingSession}
              className="bg-red-600 hover:bg-red-700"
            >
              {isResettingSession 
                ? (language === 'sp' ? 'Reiniciando...' : 'Resetting...')
                : (language === 'sp' ? 'Sí, reiniciar' : 'Yes, Reset')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="min-h-screen bg-gradient-to-br from-medical-primary-light to-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-100">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="text-center">
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
              {language === 'sp' ? 'Asistente de Admisión Clínica' : COPY.app.title}
            </h1>
            <p className="text-gray-600 text-sm md:text-base">
              {language === 'sp' ? 'Proporcione información médica para comenzar' : COPY.app.subtitle}
            </p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg animate-fade-in">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0">
                  <svg
                    className="w-5 h-5 text-red-500 mt-0.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="text-red-700 text-sm mb-2">{error}</p>
                  {retryCount > 0 && (
                    <p className="text-red-600 text-xs mb-2">
                      Attempt #{retryCount} - This may be a temporary
                      connectivity issue.
                    </p>
                  )}
                  <button
                    onClick={initializeSession}
                    className="text-red-600 underline text-sm hover:text-red-800 transition-colors"
                    disabled={isLoading}
                  >
                    {isLoading ? "Retrying..." : "Try Again"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Dynamic Progress Bar (count-based, no percentage label) */}
          {!isComplete && (
            <div className="mb-6">
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="h-2 rounded-full transition-all duration-300 bg-medical-primary"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
          )}

          {/* OCR Quality Feedback */}
          {showOcrFeedback && ocrQuality && (
            <div className="medical-card mb-6">
              <OCRQualityFeedback
                ocrQuality={ocrQuality}
                onReupload={handleOcrReupload}
                onProceed={handleOcrProceed}
                isUploading={isLoading}
              />
            </div>
          )}

          {/* Question Form */}
          {!isComplete && currentQuestion && !showOcrFeedback && (
            <div className="medical-card">
              {!isLoading ? (
                <form onSubmit={handleNext} className="space-y-6">
                  <div>
                    <label className="block text-gray-800 font-medium mb-3 text-lg leading-relaxed">
                      {currentQuestion}
                    </label>
          {questions.length === 0 ? (
                      <SymptomSelector
                        selectedSymptoms={selectedSymptoms}
                        onSymptomsChange={setSelectedSymptoms}
                        language={language}
                      />
                    ) : (
                      <div className="space-y-3">
                        <input
                          ref={inputRef}
                          type="text"
                          value={currentAnswer}
                          onChange={(e) => setCurrentAnswer(e.target.value)}
                          onKeyPress={handleKeyPress}
                          className="medical-input"
                          placeholder={language === 'sp' ? 'Escriba su respuesta aquí...' : 'Type your answer here...'}
                          required
                        />
                        {allowsImageUpload && patientId && (visitId || localStorage.getItem(`visit_${patientId}`)) && (
                          <MedicationImageUploader
                            patientId={patientId}
                            visitId={(visitId || localStorage.getItem(`visit_${patientId}`)) as string}
                            title="What medications do you take? (upload images, optional)"
                          />
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={questions.length === 0 ? selectedSymptoms.length === 0 : !currentAnswer.trim()}
                      className="medical-button w-full flex items-center justify-center gap-2"
                    >
                      {language === 'sp' ? 'Siguiente' : COPY.form.nextButton}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="flex flex-col items-center justify-center py-8">
                  <div className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin mb-4"></div>
                  <span className="text-blue-500 text-lg font-medium">
                    {language === 'sp' ? 'Esperando la siguiente pregunta...' : 'Waiting for next question...'}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Previous answers with inline edit */}
          {!isComplete && questions.length > 0 && (
            <div className="medical-card mt-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-3">
                {language === 'sp' ? 'Respuestas anteriores' : 'Previous answers'}
              </h3>
              <div className="space-y-3">
                {questions.map((qa, idx) => (
                  <div key={idx} className="border border-gray-200 rounded-md p-3">
                    <div className="text-sm text-gray-700 font-medium mb-1">Q{idx + 1}. {qa.text}</div>
                    {editingIndex === idx ? (
                      <div className="flex gap-2 items-center">
                        <input
                          type="text"
                          value={editingValue}
                          onChange={(e) => setEditingValue(e.target.value)}
                          className="medical-input flex-1"
                        />
                        {/* Manage images for this question (multi-upload, delete) */}
                        {(/medication|medicine|prescription/i.test(qa.text)) && patientId && (visitId || localStorage.getItem(`visit_${patientId}`)) && (
                          <div className="w-full">
                            <MedicationImageUploader
                              patientId={patientId}
                              visitId={(visitId || localStorage.getItem(`visit_${patientId}`)) as string}
                              title="What medications do you take? (upload images, optional)"
                              onChange={() => {/* optional refresh hooks */}}
                            />
                          </div>
                        )}
                        <button
                          onClick={async () => {
                            const effectiveVisitId = visitId || (patientId ? localStorage.getItem(`visit_${patientId}`) : null);
                            if (!patientId || !effectiveVisitId) return;
                            try {
                              setIsLoading(true);
                              const newAnswer = editingValue.trim();
                              const res = await editAnswerBackend({
                                patient_id: patientId,
                                visit_id: effectiveVisitId,
                                question_number: idx + 1,
                                new_answer: newAnswer,
                              });
                              // Keep up to edited index, replace edited answer, drop subsequent
                              setQuestions((prev) => {
                                const base = prev.slice(0, idx);
                                const edited = { text: prev[idx].text, answer: editingValue.trim() };
                                return [...base, edited];
                              });
                              // Reset flow to continue from regenerated next question
                              if (res && typeof res.next_question === "string") {
                                setCurrentQuestion(res.next_question || "");
                                setCurrentAnswer("");
                              }
                              setIsComplete(false);
                              setEditingIndex(null);
                              setEditingValue("");
                            } catch (e) {
                              console.error(e);
                            } finally {
                              setIsLoading(false);
                            }
                          }}
                          className="medical-button"
                          disabled={!editingValue.trim() || isLoading}
                        >
                          {language === 'sp' ? 'Guardar' : 'Save'}
                        </button>
                        <button
                          onClick={() => { setEditingIndex(null); setEditingValue(""); }}
                          className="px-3 py-2 rounded-md bg-gray-200 text-gray-800"
                          disabled={isLoading}
                        >
                          {language === 'sp' ? 'Cancelar' : 'Cancel'}
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <div className="text-sm text-gray-600">A: {qa.answer}</div>
                        <button
                          onClick={() => {
                            const ok = window.confirm(
                              language === 'sp' 
                                ? "Editar esta respuesta eliminará todas las preguntas posteriores y tendrá que continuar desde aquí. ¿Desea proceder?"
                                : "Editing this answer will remove all subsequent questions and you will need to continue from here. Do you want to proceed?"
                            );
                            if (!ok) return;
                            setEditingIndex(idx);
                            setEditingValue(qa.answer);
                          }}
                          className="text-blue-600 hover:underline text-sm"
                        >
                          {language === 'sp' ? 'Editar' : 'Edit'}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Fallback if no question is received */}
          {!isComplete && !currentQuestion && isInitialized && !isLoading && !visitId && (
            <div className="medical-card text-center">
              <div className="text-red-500 mb-4">
                <svg
                  className="w-12 h-12 mx-auto mb-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <h3 className="text-lg font-semibold mb-2">
                  No Question Received
                </h3>
                <p className="text-sm mb-4">
                  The system didn't receive a question from the AI assistant.
                  This might be a temporary issue with the backend.
                </p>
              </div>
              <button onClick={initializeSession} className="medical-button">
                Try Again
              </button>
            </div>
          )}

          {/* Completion Summary */}
          {isComplete && (
            <div className="medical-card">
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-medical-primary rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg
                    className="w-8 h-8 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  {isWalkInPatient ? "Walk-in Patient Ready" : COPY.summary.complete}
                </h2>
                {isWalkInPatient && (
                  <p className="text-gray-600 mb-4">
                    Patient registration complete. You can now proceed with the consultation workflow.
                  </p>
                )}
                
              </div>

              {summary && (
                <div className="bg-gray-50 rounded-lg p-4 mb-6">
                  <h3 className="font-semibold text-gray-800 mb-3">
                    {COPY.summary.title} {COPY.summary.subtitle}
                  </h3>
                  <div className="text-gray-700 whitespace-pre-line text-sm leading-relaxed">
                    {summary}
                  </div>
                </div>
              )}

              <div className="space-y-3">
                {!isWalkInPatient && (
                  <button
                    onClick={() => setShowSummaryView(true)}
                    className="w-full bg-sky-600 text-white py-3 px-4 rounded-md hover:bg-sky-700 transition-colors font-medium flex items-center justify-center gap-2"
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                    1. View Pre-Visit Summary
                  </button>
                )}
                
                {/* Step 1: Fill Vitals (Walk-in) - Must be first for walk-in flow */}
                {isWalkInPatient && (
                  <button
                    onClick={() => {
                      if (hasVitals) {
                        alert('Vitals already filled for this visit. Use "View Vitals" to see them.');
                        return;
                      }
                      
                      const effectiveVisitId = visitId || (patientId ? localStorage.getItem(`visit_${patientId}`) : null);
                      if (patientId && effectiveVisitId) {
                        const vitalsRoute = `/walk-in-vitals/${encodeURIComponent(patientId)}/${encodeURIComponent(effectiveVisitId)}`;
                        window.location.href = vitalsRoute;
                      } else {
                        alert('Missing visit information. Please start intake again.');
                      }
                    }}
                    disabled={hasVitals}
                    className={`w-full py-3 px-4 rounded-md transition-colors font-medium ${
                      hasVitals 
                        ? 'bg-gray-400 text-gray-200 cursor-not-allowed' 
                        : 'bg-amber-600 text-white hover:bg-amber-700'
                    }`}
                  >
                    1. {hasVitals ? 'Vitals Already Filled' : 'Fill Vitals'}
                  </button>
                )}
                
                {/* Step 2: Fill Vitals (Scheduled) - Comes after pre-visit summary, before transcript */}
                {!isWalkInPatient && (
                  <button
                    onClick={() => {
                      if (hasVitals) {
                        alert('Vitals already filled for this visit. Use "View Vitals" to see them.');
                        return;
                      }
                      
                      const effectiveVisitId = visitId || (patientId ? localStorage.getItem(`visit_${patientId}`) : null);
                      if (patientId && effectiveVisitId) {
                        const vitalsRoute = `/vitals/${encodeURIComponent(patientId)}/${encodeURIComponent(effectiveVisitId)}`;
                        window.location.href = vitalsRoute;
                      } else {
                        alert('Missing visit information. Please start intake again.');
                      }
                    }}
                    disabled={hasVitals}
                    className={`w-full py-3 px-4 rounded-md transition-colors font-medium ${
                      hasVitals 
                        ? 'bg-gray-400 text-gray-200 cursor-not-allowed' 
                        : 'bg-amber-600 text-white hover:bg-amber-700'
                    }`}
                  >
                    {hasVitals 
                      ? '2. Vitals Already Filled' 
                      : '2. Fill Vitals'}
                  </button>
                )}
                
                {/* Step 2: Upload Transcript (Walk-in) / Step 3: Upload Transcript (Scheduled) */}
                <button
                  onClick={() => {
                    if (hasTranscript) {
                      alert('Transcript already uploaded for this visit. Use "View Transcript" to see it.');
                      return;
                    }
                    setShowUploadAudio(true);
                  }}
                  disabled={hasTranscript}
                  className={`w-full py-3 px-4 rounded-md transition-colors font-medium ${
                    hasTranscript 
                      ? 'bg-gray-400 text-gray-200 cursor-not-allowed' 
                      : 'bg-indigo-600 text-white hover:bg-indigo-700'
                  }`}
                >
                  {isWalkInPatient 
                    ? (hasTranscript ? '2. Transcript Already Uploaded' : '2. Upload Transcript')
                    : (hasTranscript ? '3. Transcript Already Uploaded' : '3. Upload Transcript')}
                </button>
                
                {/* Step 3: View Transcript (Walk-in) / Step 4: View Transcript (Scheduled) */}
                <button
                  onClick={async () => {
                    try {
                      if (!patientId || !visitId) return;
                      const resp = await authorizedFetch(`${BACKEND_BASE_URL}/notes/${patientId}/visits/${visitId}/transcript`);
                      
                      // Check for 202 (Still Processing) BEFORE trying to parse JSON
                      if (resp.status === 202) {
                        alert('Transcript is still being processed. Please wait a moment and try again.');
                        return;
                      }
                      
                      if (!resp.ok) {
                        const txt = await resp.text();
                        throw new Error(`Failed to fetch transcript ${resp.status}: ${txt}`);
                      }
                      
                      // Only parse JSON if status is 200
                      const responseData = await resp.json();
                      // Extract data from ApiResponse wrapper
                      const data = responseData.data || responseData;
                      // Prefer structured_dialogue if available
                      let transcriptContent = '';
                      if (data.structured_dialogue && Array.isArray(data.structured_dialogue) && data.structured_dialogue.length > 0) {
                        transcriptContent = JSON.stringify(data.structured_dialogue);
                      } else if (data.transcript) {
                        transcriptContent = data.transcript;
                      }
                      setTranscriptText(transcriptContent);
                      setShowTranscript(true);
                    } catch (e) {
                      alert('Transcript not available yet.');
                    }
                  }}
                  className="w-full bg-violet-600 text-white py-3 px-4 rounded-md hover:bg-violet-700 transition-colors font-medium"
                >
                  {isWalkInPatient ? '3. View Transcript' : '4. View Transcript'}
                </button>
                
                {/* Step 4: Generate SOAP Summary (Walk-in) / Step 5: Generate SOAP Summary (Scheduled) */}
                <button
                  onClick={async () => {
                    if (hasSoap) {
                      alert('SOAP summary already generated for this visit. Use "View SOAP Summary" to see it.');
                      return;
                    }
                    
                    try {
                      if (!patientId || !visitId) return;
                      setShowPostVisitProcessing(true); // Reuse loading state
                      
                      const response = await authorizedFetch(`${BACKEND_BASE_URL}/notes/soap/generate`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                        body: JSON.stringify({ patient_id: patientId, visit_id: visitId })
                      });
                      
                      if (response.ok) {
                        // Set localStorage flag and update state
                        try {
                          localStorage.setItem(`soap_done_${patientId}_${visitId}`, '1');
                        } catch {}
                        setHasSoap(true);
                        alert('SOAP summary generation started successfully! You can view it using the "View SOAP Summary" button.');
                      } else {
                        const errorData = await response.json();
                        console.error('SOAP generation error - Full response:', JSON.stringify(errorData, null, 2));
                        // Extract detailed error message
                        let errorMsg = 'Failed to generate SOAP summary';
                        if (errorData.detail) {
                          if (typeof errorData.detail === 'string') {
                            errorMsg = errorData.detail;
                          } else if (errorData.detail.message) {
                            errorMsg = errorData.detail.message;
                          } else if (errorData.detail.error) {
                            errorMsg = `${errorData.detail.error}: ${errorData.detail.message || 'Unknown error'}`;
                          }
                        } else if (errorData.message) {
                          errorMsg = errorData.message;
                        }
                        // Show detailed error with all available info
                        const details = errorData.detail?.details ? `\nDetails: ${JSON.stringify(errorData.detail.details)}` : '';
                        alert(`Error: ${errorMsg}${details}\n\nPlease ensure:\n- Transcript is complete\n- Vitals are filled\n- Visit status is correct`);
                      }
                      setShowPostVisitProcessing(false);
                    } catch (e) {
                      setShowPostVisitProcessing(false);
                      alert('Failed to generate SOAP summary. Please ensure transcript and vitals are complete.');
                    }
                  }}
                  disabled={hasSoap}
                  className={`w-full py-3 px-4 rounded-md transition-colors font-medium ${
                    hasSoap 
                      ? 'bg-gray-400 text-gray-200 cursor-not-allowed' 
                      : 'bg-orange-600 text-white hover:bg-orange-700'
                  }`}
                >
                  {hasSoap 
                    ? `${isWalkInPatient ? '4' : '5'}. SOAP Summary Already Generated` 
                    : `${isWalkInPatient ? '4' : '5'}. Generate SOAP Summary`}
                </button>
                
                {/* Step 5: View SOAP Summary (Walk-in) / Step 6: View SOAP Summary (Scheduled) */}
                <button
                  onClick={() => {
                    const effectiveVisitId = visitId || (patientId ? localStorage.getItem(`visit_${patientId}`) : null);
                    if (patientId && effectiveVisitId) {
                      const soapRoute = isWalkInPatient 
                        ? `/walk-in-soap/${encodeURIComponent(patientId)}/${encodeURIComponent(effectiveVisitId)}`
                        : `/soap/${encodeURIComponent(patientId)}/${encodeURIComponent(effectiveVisitId)}`;
                      window.location.href = soapRoute;
                    } else {
                      alert('Missing visit information. Please refresh the page.');
                    }
                  }}
                  className="w-full bg-rose-600 text-white py-3 px-4 rounded-md hover:bg-rose-700 transition-colors font-medium"
                >
                  {isWalkInPatient ? '5' : '6'}. View SOAP Summary
                </button>

                {/* Step 6: Create Post Visit Summary (Walk-in) / Step 7: Create Post Visit Summary (Scheduled) */}
                <button
                  onClick={async () => {
                    if (hasPostVisitSummary) {
                      alert('Post-visit summary already exists. Use "View Post Visit Summary" to see it.');
                      return;
                    }
                    
                    try {
                      if (!patientId || !visitId) return;
                      setShowPostVisitProcessing(true);
                      const response = await authorizedFetch(`${BACKEND_BASE_URL}/patients/summary/postvisit`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                        body: JSON.stringify({ patient_id: patientId, visit_id: visitId })
                      });
                      
                      if (response.status === 422) {
                        const errorData = await response.json();
                        if (errorData.detail?.message?.includes('already exists')) {
                          setHasPostVisitSummary(true);
                          alert('Post-visit summary already exists!');
                        } else {
                          alert(`Error: ${errorData.detail?.message || 'Failed to create post-visit summary'}`);
                        }
                      } else if (response.ok) {
                        setHasPostVisitSummary(true);
                        alert('Post-visit summary created successfully!');
                      } else {
                        alert('Failed to generate Post-Visit Summary.');
                      }
                      setShowPostVisitProcessing(false);
                    } catch (e) {
                      setShowPostVisitProcessing(false);
                      alert('Failed to generate Post-Visit Summary.');
                    }
                  }}
                  disabled={hasPostVisitSummary}
                  className={`w-full py-3 px-4 rounded-md transition-colors font-medium ${
                    hasPostVisitSummary 
                      ? 'bg-gray-400 text-gray-200 cursor-not-allowed' 
                      : 'bg-cyan-600 text-white hover:bg-cyan-700'
                  }`}
                >
                  {hasPostVisitSummary 
                    ? `${isWalkInPatient ? '6' : '7'}. Post Visit Summary Already Created` 
                    : `${isWalkInPatient ? '6' : '7'}. Create Post Visit Summary`}
                </button>

                {/* Step 7: View Post Visit Summary (Walk-in) / Step 8: View Post Visit Summary (Scheduled) */}
                <button
                  onClick={() => {
                    const effectiveVisitId = visitId || (patientId ? localStorage.getItem(`visit_${patientId}`) : null);
                    
                    if (patientId && effectiveVisitId) {
                      const postVisitRoute = isWalkInPatient 
                        ? `/walk-in-post-visit/${encodeURIComponent(patientId)}/${encodeURIComponent(effectiveVisitId)}`
                        : `/post-visit/${encodeURIComponent(patientId)}/${encodeURIComponent(effectiveVisitId)}`;
                      window.location.href = postVisitRoute;
                    } else {
                      alert(`Missing information: patientId=${patientId}, visitId=${effectiveVisitId}. Please refresh the page or go back to registration.`);
                    }
                  }}
                  className="w-full bg-emerald-600 text-white py-3 px-4 rounded-md hover:bg-emerald-700 transition-colors font-medium"
                >
                  <svg
                    className="w-5 h-5 inline mr-2"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                  {isWalkInPatient ? '7' : '8'}. View Post Visit Summary
                </button>


                {/* Removed "Start New Intake" button per request */}

                {/* Step 8: Register New Patient (Walk-in) / Step 9: Register New Patient (Scheduled) */}
                {isWalkInPatient && (
                  <button
                    onClick={() =>
                      (window.location.href = "/walk-in-registration")
                    }
                    className="w-full bg-slate-700 text-white py-3 px-4 rounded-md hover:bg-slate-800 transition-colors font-medium"
                  >
                    <svg
                      className="w-5 h-5 inline mr-2"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
                      />
                    </svg>
                    8. Register New Patient
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-100 py-4">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <p className="text-gray-500 text-sm">{COPY.footer.disclaimer}</p>
        </div>
      </footer>

      {/* Summary View Modal */}
      {showSummaryView && patientId && visitId && (
        <SummaryView
          patientId={patientId}
          visitId={visitId}
          onClose={() => setShowSummaryView(false)}
        />
      )}

      {/* Upload Audio Modal */}
      {showUploadAudio && patientId && visitId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Upload Consultation Audio</h3>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setUploadAudioError("");
                try {
                  // Reset any previous transcript view while re-uploading
                  setShowTranscript(false);
                  setTranscriptText("");
                  setIsTranscribingAudio(true);
                  const input = document.getElementById('upload-audio-input') as HTMLInputElement | null;
                  const selected = input?.files && input.files[0] ? input.files[0] : null;
                  const useBlob = recordedBlob ? new File([recordedBlob], 'recorded.webm', { type: 'audio/webm' }) : null;
                  if (!useBlob && !selected) {
                    setUploadAudioError('Please record audio or choose a file.');
                    setIsTranscribingAudio(false);
                    return;
                  }
                  const form = new FormData();
                  form.append('patient_id', patientId);
                  form.append('visit_id', visitId);
                  try { form.append('language', language as any); } catch {}
                  const chosen = (useBlob || selected) as File;
                  form.append('audio_file', chosen);
                  try {
                    console.log('Uploading audio file:', chosen?.name, chosen?.type, chosen?.size);
                    console.log('Form data:', {
                      patient_id: patientId,
                      visit_id: visitId,
                      audio_file: chosen?.name
                    });
                  } catch {}
                  
                  const controller = new AbortController();
                  const timeoutId = setTimeout(() => controller.abort(), 300000); // 5 minute timeout
                  
                  const resp = await authorizedFetch(`${BACKEND_BASE_URL}/notes/transcribe`, {
                    method: 'POST',
                    body: form,
                    headers: {
                      'Accept': 'application/json',
                    },
                    mode: 'cors',
                    signal: controller.signal,
                  });
                  
                  clearTimeout(timeoutId);
                  
                  // State machine: uploading done -> processing with backoff polling honoring Retry-After
                  if (resp.status === 202) {
                    setShowUploadAudio(false);
                    setShowTranscriptProcessing(true);
                    const start = Date.now();
                    let attempt = 0;
                    const maxMs = 1800000; // 30 minutes (increased for long audio files)
                    const poll = async () => {
                      attempt += 1;
                      const delay = Math.min(6000, 2000 + attempt * 500);
                      
                      // Update status based on attempt number
                      if (attempt <= 3) {
                        setTranscriptProcessingStatus("Transcribing audio...");
                      } else if (attempt <= 8) {
                        setTranscriptProcessingStatus("Processing transcript...");
                      } else if (attempt <= 15) {
                        setTranscriptProcessingStatus("Structuring dialogue...");
                      } else {
                        setTranscriptProcessingStatus("Finalizing transcript...");
                      }
                      
                      try {
                        // First check the status endpoint to see if transcription failed
                        const statusRes = await authorizedFetch(`${BACKEND_BASE_URL}/notes/transcribe/status/${patientId}/${visitId}`);
                        if (statusRes.ok) {
                          const statusData = await statusRes.json();
                          const status = statusData.data?.status || statusData.status;
                          
                          // If transcription failed, stop polling and show error
                          if (status === "failed") {
                            setShowTranscriptProcessing(false);
                            setUploadAudioError(statusData.data?.message || statusData.message || "Transcription failed. Please try again.");
                            setShowUploadAudio(true);
                            return;
                          }
                          
                          // If still processing, continue polling
                          if (status === "pending" || status === "processing") {
                            const ra = statusRes.headers.get('Retry-After');
                            const retryAfterMs = ra ? Math.max(0, Number(ra) * 1000) : 0;
                            const backoffMs = Math.min(15000, Math.round(1500 * Math.pow(1.6, attempt)));
                            const delay = retryAfterMs || backoffMs;
                            
                            // Only timeout after 30 minutes AND verify it's actually taking too long
                            if (Date.now() - start < maxMs) {
                              setTimeout(poll, delay);
                              return;
                            } else {
                              // Check one more time if it's actually failed before showing timeout
                              const finalStatusRes = await authorizedFetch(`${BACKEND_BASE_URL}/notes/transcribe/status/${patientId}/${visitId}`);
                              if (finalStatusRes.ok) {
                                const finalStatusData = await finalStatusRes.json();
                                const finalStatus = finalStatusData.data?.status || finalStatusData.status;
                                if (finalStatus === "failed") {
                                  setShowTranscriptProcessing(false);
                                  setUploadAudioError(finalStatusData.data?.message || finalStatusData.message || "Transcription failed. Please try again.");
                                  setShowUploadAudio(true);
                                  return;
                                }
                              }
                              
                              setShowTranscriptProcessing(false);
                              setUploadAudioError('Transcription is taking longer than expected. The file is still being processed. Please check back in a few minutes or try with a shorter audio file.');
                              setShowUploadAudio(true);
                              return;
                            }
                          }
                        }
                        
                        // Fetch the transcript
                        const t = await authorizedFetch(`${BACKEND_BASE_URL}/notes/${patientId}/visits/${visitId}/transcript`);
                        
                        // Check for 202 (Still Processing) BEFORE trying to parse JSON
                        // Backend returns empty body for 202, so we must handle it first
                        if (t.status === 202) {
                          // Still processing, continue polling
                          const ra = t.headers.get('Retry-After');
                          const retryAfterMs = ra ? Math.max(0, Number(ra) * 1000) : 0;
                          const backoffMs = Math.min(15000, Math.round(1500 * Math.pow(1.6, attempt)));
                          const delay = retryAfterMs || backoffMs;
                          if (Date.now() - start < maxMs) {
                            setTimeout(poll, delay);
                            return;
                          } else {
                            setShowTranscriptProcessing(false);
                            setUploadAudioError('Transcription is taking longer than expected. The file is still being processed. Please check back in a few minutes or try with a shorter audio file.');
                            setShowUploadAudio(true);
                            return;
                          }
                        }
                        
                        // Only parse JSON if status is 200 (not 202)
                        if (t.ok && t.status === 200) {
                          const response = await t.json();
                          // Extract data from ApiResponse wrapper
                          const data = response.data || response;
                          
                          // Prefer structured_dialogue if available, otherwise use transcript
                          let transcriptContent = '';
                          if (data.structured_dialogue && Array.isArray(data.structured_dialogue) && data.structured_dialogue.length > 0) {
                            // Convert structured dialogue array to JSON string for TranscriptView
                            transcriptContent = JSON.stringify(data.structured_dialogue);
                          } else if (data.transcript) {
                            transcriptContent = data.transcript;
                            
                            // Check if transcript appears to be raw (not structured JSON)
                            const isRawTranscript = !transcriptContent.includes('"Doctor"') && !transcriptContent.includes('"Patient"');
                            
                            if (isRawTranscript && transcriptContent.trim()) {
                              // Try to structure the dialogue using the backend endpoint
                              try {
                                const structureResponse = await authorizedFetch(`${BACKEND_BASE_URL}/notes/${patientId}/visits/${visitId}/dialogue/structure`, {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' }
                                });
                                if (structureResponse.ok) {
                                  const structureResponseData = await structureResponse.json();
                                  const structureData = structureResponseData.data || structureResponseData;
                                  if (structureData.dialogue && typeof structureData.dialogue === 'object') {
                                    transcriptContent = JSON.stringify(structureData.dialogue);
                                  }
                                }
                              } catch (e) {
                                console.warn('Failed to structure dialogue:', e);
                              }
                            }
                          }
                          
                          setTranscriptText(transcriptContent);
                          setShowTranscriptProcessing(false);
                          setShowTranscript(true);
                          try {
                            const key = patientId && visitId ? `transcript_done_${patientId}_${visitId}` : null;
                            if (key) localStorage.setItem(key, '1');
                            setHasTranscript(true);
                          } catch {}
                          return;
                        }
                        
                        // If we get here, there was an error (not 200 or 202)
                        console.error('Unexpected transcript response status:', t.status);
                        if (Date.now() - start < maxMs) {
                          const delay = Math.min(15000, Math.round(1500 * Math.pow(1.6, attempt)));
                          setTimeout(poll, delay);
                        } else {
                          setShowTranscriptProcessing(false);
                          setUploadAudioError('Transcription is taking longer than expected. The file is still being processed. Please check back in a few minutes or try with a shorter audio file.');
                          setShowUploadAudio(true);
                          }
                      } catch (err: any) {
                        console.error('Polling error:', err);
                        // Only continue polling if we haven't timed out
                      if (Date.now() - start < maxMs) {
                        const delay = Math.min(15000, Math.round(1500 * Math.pow(1.6, attempt)));
                        setTimeout(poll, delay);
                      } else {
                        setShowTranscriptProcessing(false);
                        setUploadAudioError('Processing timed out after 10 minutes. This can happen with very long audio files. Please try with a shorter audio file or contact support if the issue persists.');
                        setShowUploadAudio(true);
                        }
                      }
                    };
                    poll();
                  } else if (!resp.ok) {
                    const txt = await resp.text();
                    console.error('Upload failed:', txt);
                    throw new Error(`Upload failed ${resp.status}: ${txt}`);
                  } else {
                    setShowUploadAudio(false);
                    setShowTranscriptProcessing(true);
                  }
                } catch (err: any) {
                  console.error('Audio upload error:', err);
                  if (err.name === 'AbortError') {
                    setUploadAudioError('Upload timed out. Please try again with a shorter audio file.');
                  } else if (err.message.includes('Failed to fetch')) {
                    setUploadAudioError('Network error. Please check your connection and try again.');
                  } else {
                    setUploadAudioError(err?.message || 'Failed to upload audio. Please try again.');
                  }
                } finally {
                  setIsTranscribingAudio(false);
                }
              }}
              className="space-y-4"
            >
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-800">Choose audio file</label>
                <input
                  id="upload-audio-input"
                  type="file"
                  accept="audio/*,video/mpeg,.mp3,.m4a,.aac,.wav,.ogg,.flac,.amr,.mpeg,.webm"
                  className="block w-full text-sm text-gray-700"
                  onChange={() => setRecordedBlob(null)}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-800">Or record live</label>
                <div className="flex items-center gap-2">
                  {!recording ? (
                    <button type="button" onClick={startRecording} className="px-3 py-2 rounded bg-emerald-600 text-white hover:bg-emerald-700">Start Recording</button>
                  ) : (
                    <button type="button" onClick={stopRecording} className="px-3 py-2 rounded bg-red-600 text-white hover:bg-red-700">Stop ({recordSeconds}s)</button>
                  )}
                  {recordedBlob && (
                    <audio controls src={URL.createObjectURL(recordedBlob)} className="h-9" />
                  )}
                </div>
                <p className="text-xs text-gray-500">Recorded audio (if present) will be uploaded; otherwise the selected file.</p>
              </div>
              {uploadAudioError && (
                <div className="text-sm text-red-600">{uploadAudioError}</div>
              )}
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowUploadAudio(false)}
                  className="px-4 py-2 rounded bg-gray-200 text-gray-800"
                  disabled={isTranscribingAudio}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded bg-purple-600 text-white disabled:opacity-60"
                  disabled={isTranscribingAudio}
                >
                  {isTranscribingAudio ? 'Uploading...' : 'Upload & Transcribe'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Transcript Processing Modal */}
      {showTranscriptProcessing && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-6 text-center">
            <div className="w-10 h-10 border-2 border-medical-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">{transcriptProcessingStatus}</h3>
            <p className="text-sm text-gray-600">This may take up to 10 minutes for complex audio files. The transcript will open automatically when ready.</p>
          </div>
        </div>
      )}

      {/* Post-Visit Summary Processing Modal */}
      {showPostVisitProcessing && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-6 text-center">
            <div className="w-10 h-10 border-2 border-cyan-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {language === 'sp' ? 'Creando Resumen Post-Visita…' : 'Creating Post-Visit Summary…'}
            </h3>
            <p className="text-sm text-gray-600">
              {language === 'sp' 
                ? 'Esto puede tomar unos minutos. El resumen estará disponible cuando esté listo.' 
                : 'This may take up to a few minutes. The summary will be available when ready.'}
            </p>
          </div>
        </div>
      )}

      {/* Transcript Modal */}
      {showTranscript && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-4xl max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b">
              <h3 className="text-xl font-semibold text-gray-900">Transcript</h3>
              <button
                type="button"
                onClick={() => setShowTranscript(false)}
                aria-label="Close"
                className="h-8 w-8 flex items-center justify-center rounded-full bg-gray-200 text-gray-700 hover:bg-gray-300"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
            <div className="max-h-[70vh] overflow-y-auto">
              <TranscriptView content={transcriptText} />
            </div>
          </div>
        </div>
      )}
    </div>
    </>
  );
};

export default Index;