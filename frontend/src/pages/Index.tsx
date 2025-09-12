import React, { useState, useEffect, useRef } from "react";
import { useParams, useLocation } from "react-router-dom";
import { intakeAPI, IntakeRequest, IntakeResponse } from "../api";
import { answerIntakeBackend, editAnswerBackend } from "../services/patientService";
import { SessionManager } from "../utils/session";
import { COPY } from "../copy";
import SymptomSelector from "../components/SymptomSelector";

interface Question {
  text: string;
  answer: string;
}

const Index = () => {
  const { patientId } = useParams<{ patientId: string }>();
  const location = useLocation();
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
  const [editingValue, setEditingValue] = useState<string>("");

  const inputRef = useRef<HTMLInputElement>(null);

  // On mount, if q is present in URL, show it immediately and cache visit id
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const q = params.get("q");
    const v = params.get("v");
    if (q && q.trim()) {
      setCurrentQuestion(q);
      setShowStartScreen(false);
      setIsInitialized(true);
    }
    if (patientId && v) {
      localStorage.setItem(`visit_${patientId}`, v);
      setVisitId(v);
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
  }, [location.search]);

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

  const initializeSession = async () => {
    try {
      setIsLoading(true);
      setError("");

      console.log("Initializing session with patient ID:", patientId);

      // Test connection first
      const canConnect = await intakeAPI.testConnection();
      console.log("Connection test result:", canConnect);

      const sessionId = SessionManager.getSessionId();
      console.log("Session ID:", sessionId);

      // Get symptoms from localStorage if available
      const symptomsData = patientId ? localStorage.getItem(`symptoms_${patientId}`) : null;
      let symptoms = null;
      if (symptomsData) {
        try {
          symptoms = JSON.parse(symptomsData);
        } catch (e) {
          // Fallback for old string format
          symptoms = symptomsData;
        }
      }
      console.log("Retrieved symptoms:", symptoms);

      // If we already have first question via q param, skip initialization call
      if (!currentQuestion) {
        const request: IntakeRequest = {
          session_id: sessionId,
          patient_id: patientId,
          initial_symptoms: symptoms || undefined,
        };
        const response = await intakeAPI.sendIntakeData(request);
        handleResponse(response);
      }
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

  const handleResponse = (response: IntakeResponse & { completion_percent?: number }) => {
    console.log("Backend response:", response);
    if (typeof response.completion_percent === "number") {
      setCompletionPercent(Math.max(0, Math.min(100, response.completion_percent)));
    }
    if (response.next_question === "COMPLETE") {
      setIsComplete(true);
      setSummary(
        response.summary || "Thank you for completing your intake form."
      );
      setCurrentQuestion("");
    } else if (
      typeof response.next_question === "string" &&
      response.next_question.trim() !== ""
    ) {
      setCurrentQuestion(response.next_question);
      pendingNextQuestionRef.current = response.next_question;
      setCurrentAnswer("");
    } else {
      setError("No next question received from backend. Please try again.");
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

      // If the question suggests medication/photo, we will collect an optional image
      const medsHint = currentQuestion.includes("You can upload a clear photo") || /medication|medicine|prescription/i.test(currentQuestion);
      let response;
      if (medsHint && (window as any).clinicaiMedicationFile) {
        const form = new FormData();
        form.append("patient_id", patientId);
        form.append("visit_id", effectiveVisitId!);
        form.append("answer", answerToSend);
        form.append("medication_image", (window as any).clinicaiMedicationFile);
        response = await fetch("/patients/consultations/answer", {
          method: "POST",
          body: form,
        }).then(r => r.json());
      } else {
        response = await answerIntakeBackend({
          patient_id: patientId,
          visit_id: effectiveVisitId!,
          answer: answerToSend,
        });
      }
      if (response && typeof response.max_questions === "number") {
        localStorage.setItem(`maxq_${effectiveVisitId}`, String(response.max_questions));
      }
      console.log("Received response from backend:", response);
      handleResponse({
        next_question: response.next_question || "",
        summary: undefined,
        type: "text",
        completion_percent: response.completion_percent,
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

  // Show start screen if not initialized and not loading
  if (showStartScreen && !isLoading) {
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
    <div className="min-h-screen bg-gradient-to-br from-medical-primary-light to-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-100">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="text-center">
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
              {COPY.app.title}
            </h1>
            <p className="text-gray-600 text-sm md:text-base">
              {COPY.app.subtitle}
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

          {/* Dynamic Progress Bar (percentage only) */}
          {!isComplete && (
            <div className="mb-6">
              <div className="flex items-center justify-end text-sm text-gray-600 mb-2">
                <span>{isComplete ? 100 : completionPercent}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="h-2 rounded-full transition-all duration-300 bg-medical-primary"
                  style={{ width: `${Math.min(100, Math.max(0, isComplete ? 100 : completionPercent))}%` }}
                />
              </div>
            </div>
          )}

          {/* Question Form */}
          {!isComplete && currentQuestion && (
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
                          placeholder="Type your answer here..."
                          required
                        />
                        {(/medication|medicine|prescription/i.test(currentQuestion)) && (
                          <div className="flex items-center gap-2">
                            <input
                              type="file"
                              accept="image/*;capture=camera"
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                (window as any).clinicaiMedicationFile = f || null;
                              }}
                              className="block w-full text-sm text-gray-700"
                            />
                          </div>
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
                      {COPY.form.nextButton}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="flex flex-col items-center justify-center py-8">
                  <div className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin mb-4"></div>
                  <span className="text-blue-500 text-lg font-medium">
                    Waiting for next question...
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Previous answers with inline edit */}
          {!isComplete && questions.length > 0 && (
            <div className="medical-card mt-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-3">Previous answers</h3>
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
                        <button
                          onClick={async () => {
                            const effectiveVisitId = visitId || (patientId ? localStorage.getItem(`visit_${patientId}`) : null);
                            if (!patientId || !effectiveVisitId) return;
                            try {
                              setIsLoading(true);
                              await editAnswerBackend({
                                patient_id: patientId,
                                visit_id: effectiveVisitId,
                                question_number: idx + 1,
                                new_answer: editingValue.trim(),
                              });
                              setQuestions((prev) => {
                                const copy = [...prev];
                                copy[idx] = { ...copy[idx], answer: editingValue.trim() };
                                return copy;
                              });
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
                          Save
                        </button>
                        <button
                          onClick={() => { setEditingIndex(null); setEditingValue(""); }}
                          className="px-3 py-2 rounded-md bg-gray-200 text-gray-800"
                          disabled={isLoading}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <div className="text-sm text-gray-600">A: {qa.answer}</div>
                        <button
                          onClick={() => { setEditingIndex(idx); setEditingValue(qa.answer); }}
                          className="text-blue-600 hover:underline text-sm"
                        >
                          Edit
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Fallback if no question is received */}
          {!isComplete && !currentQuestion && isInitialized && !isLoading && (
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
                  {COPY.summary.complete}
                </h2>
                
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
                <button
                  onClick={handleStartNew}
                  className="medical-button w-full"
                >
                  {COPY.form.startNew}
                </button>
                <button
                  onClick={() =>
                    (window.location.href = "/patient-registration")
                  }
                  className="w-full bg-gray-600 text-white py-3 px-4 rounded-md hover:bg-gray-700 transition-colors font-medium"
                >
                  Register New Patient
                </button>
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
    </div>
  );
};

export default Index;
