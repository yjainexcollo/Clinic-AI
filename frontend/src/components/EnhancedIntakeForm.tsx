import React, { useEffect, useState } from "react";
import { answerIntakeBackend, BackendAnswerResponse, editAnswerBackend, BackendEditAnswerResponse } from "../services/patientService";
import { getSessionId } from "../utils/uuid";
import SummaryCard from "./SummaryCard";
import { Card, CardHeader, CardTitle, CardContent } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { CheckCircle, Clock, User, Send } from "lucide-react";

type HistoryEntry = {
  question: string;
  answer: string;
};

const TOTAL_QUESTIONS = 10;
const FIRST_QUESTION = "Why have you come in today? What is the main concern you want help with?";

interface EnhancedIntakeFormProps {
  patientId: string; // opaque id from backend
  visitId: string;
  onIntakeComplete?: (sessionId: string, summary: string) => void;
}

const EnhancedIntakeForm: React.FC<EnhancedIntakeFormProps> = ({
  patientId,
  visitId,
  onIntakeComplete,
}) => {
  const [sessionId] = useState(getSessionId());
  const [currentQuestion, setCurrentQuestion] =
    useState<string>(FIRST_QUESTION);
  const [currentType, setCurrentType] = useState<string>("text");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [aiStarted, setAiStarted] = useState(false);
  const [lastAiQuestion, setLastAiQuestion] = useState<string | null>(null);
  const [intakeStatus, setIntakeStatus] = useState<
    "in_progress" | "completed" | "sent_to_doctor"
  >("in_progress");
  const [assignedDoctor, setAssignedDoctor] = useState<string | null>(null);
  const [questionCount, setQuestionCount] = useState<number>(0);
  const [maxQuestions, setMaxQuestions] = useState<number>(10);
  const [completionPercent, setCompletionPercent] = useState<number>(0);

  // On mount, always show the first static question
  useEffect(() => {
    setCurrentQuestion(FIRST_QUESTION);
    setCurrentType("text");
    setSummary(null);
    setHistory([]);
    setInput("");
    setError(null);
    setSubmitted(false);
    setAiStarted(false);
    setLastAiQuestion(null);
    setIntakeStatus("in_progress");
    setAssignedDoctor(null);
  }, [sessionId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !currentQuestion) return;
    setLoading(true);
    setError(null);
    const answer = input;
    setInput("");
    try {
      // Always send the answer to backend; backend caches next question
      const backendRes: BackendAnswerResponse = await answerIntakeBackend({
        patient_id: patientId,
        visit_id: visitId,
        answer,
      }, imageFile || undefined);
      const newHistory = [
        ...history,
        { question: currentQuestion, answer },
      ];
      setHistory(newHistory);
      setImageFile(null);
      setCurrentQuestion(backendRes.next_question || "");
      setCurrentType("text");
      setSummary(null);
      setAiStarted(true);
      setLastAiQuestion(backendRes.next_question || null);
      setQuestionCount(backendRes.question_count);
      setMaxQuestions(backendRes.max_questions);
      setCompletionPercent(
        typeof backendRes.completion_percent === "number"
          ? backendRes.completion_percent
          : Math.min(
              Math.round(
                ((Math.max(questionCount, history.length)) / (maxQuestions || TOTAL_QUESTIONS)) * 100
              ),
              100
            )
      );

      if (backendRes.is_complete || !backendRes.next_question) {
        setSubmitted(true);
        setIntakeStatus("completed");
        await handleIntakeComplete();
        // Fire pre-visit summary generation (best-effort)
        try {
          await fetch("http://localhost:8000/patients/summary/previsit", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ patient_id: patientId, visit_id: visitId }),
          });
        } catch (e) {
          // ignore
        }
      }
    } catch {
      setError("Failed to submit answer. Please try again.");
      setInput(answer); // restore input
    } finally {
      setLoading(false);
    }
  };

  const handleIntakeComplete = async () => {
    try {
      // Create intake session record
      const intakeSessionData = {
        patientId,
        sessionId,
        status: "completed" as const,
        summary: summary || "",
        history: history.map((entry) => ({
          question: entry.question,
          answer: entry.answer,
          timestamp: new Date().toISOString(),
        })),
      };

      // Send to integrated API
      const response = await fetch("/api/intake-sessions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(intakeSessionData),
      });

      if (response.ok) {
        const result = await response.json();
        setAssignedDoctor(result.assignedDoctorId);
        setIntakeStatus("sent_to_doctor");

        // Notify parent component
        if (onIntakeComplete) {
          onIntakeComplete(sessionId, summary || "");
        }
      }
    } catch (error) {
      console.error("Failed to complete intake:", error);
      setError("Failed to send intake to doctor");
    }
  };

  const getStatusIcon = () => {
    switch (intakeStatus) {
      case "in_progress":
        return <Clock className="h-5 w-5 text-yellow-600" />;
      case "completed":
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case "sent_to_doctor":
        return <Send className="h-5 w-5 text-blue-600" />;
      default:
        return <Clock className="h-5 w-5 text-gray-600" />;
    }
  };

  const getStatusText = () => {
    switch (intakeStatus) {
      case "in_progress":
        return "In Progress";
      case "completed":
        return "Completed";
      case "sent_to_doctor":
        return "Sent to Doctor";
      default:
        return "Unknown";
    }
  };

  const getStatusColor = () => {
    switch (intakeStatus) {
      case "in_progress":
        return "bg-yellow-100 text-yellow-800";
      case "completed":
        return "bg-green-100 text-green-800";
      case "sent_to_doctor":
        return "bg-blue-100 text-blue-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-medical-primary-light to-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-medical-800 mb-2">
            Patient Health Intake
          </h1>
          <p className="text-medical-600 mb-4">
            Please answer the following questions to help your doctor prepare
            for your appointment
          </p>

          {/* Status Indicator */}
          <div className="flex items-center justify-center space-x-2 mb-4">
            {getStatusIcon()}
            <Badge className={getStatusColor()}>{getStatusText()}</Badge>
          </div>
        </div>

        {/* Progress Indicator */}
        <div className="mb-6">
          <div className="flex items-center justify-between text-sm text-medical-600 mb-2">
            <span>Progress</span>
            <span>
              {Math.max(questionCount, history.length)} of {maxQuestions}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-medical-600 h-2 rounded-full transition-all duration-300"
              style={{
                width: `${Math.min(100, Math.round(((Math.max(questionCount, history.length)) / (maxQuestions || 1)) * 100))}%`,
              }}
            ></div>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Question Form */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <User className="h-5 w-5 mr-2" />
                Health Assessment
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!submitted ? (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-medical-700 mb-2">
                      {currentQuestion}
                    </label>
                    {currentType === "text" && (
                      <textarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Please provide your answer..."
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-medical-500 focus:border-transparent resize-none"
                        rows={4}
                        disabled={loading}
                      />
                    )}
                    {/* Optional image upload */}
                    <div className="mt-3">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => setImageFile(e.target.files && e.target.files[0] ? e.target.files[0] : null)}
                        disabled={loading}
                      />
                    </div>
                    {currentType === "yes_no" && (
                      <div className="space-y-2">
                        <Button
                          type="button"
                          variant={input === "yes" ? "default" : "outline"}
                          onClick={() => setInput("yes")}
                          disabled={loading}
                          className="w-full"
                        >
                          Yes
                        </Button>
                        <Button
                          type="button"
                          variant={input === "no" ? "default" : "outline"}
                          onClick={() => setInput("no")}
                          disabled={loading}
                          className="w-full"
                        >
                          No
                        </Button>
                      </div>
                    )}
                  </div>

                  {error && (
                    <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg">
                      {error}
                    </div>
                  )}

                  <Button
                    type="submit"
                    disabled={!input.trim() || loading}
                    className="w-full"
                  >
                    {loading ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Processing...
                      </>
                    ) : (
                      "Submit Answer"
                    )}
                  </Button>
                </form>
              ) : (
                <div className="text-center py-8">
                  <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-medical-800 mb-2">
                    Intake Complete!
                  </h3>
                  <p className="text-medical-600 mb-4">
                    Your responses have been sent to your doctor for review.
                  </p>
                  {assignedDoctor && (
                    <div className="bg-blue-50 p-4 rounded-lg">
                      <p className="text-sm text-blue-800">
                        Assigned to: Dr. {assignedDoctor}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Summary and History */}
          <div className="space-y-6">
            {/* Current Summary */}
            {summary && (
              <SummaryCard
                title="Current Summary"
                content={summary}
                className="bg-white"
              />
            )}

            {/* Conversation History */}
            {history.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Conversation History</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4 max-h-96 overflow-y-auto">
                    {history.map((entry, index) => (
                      <div
                        key={index}
                        className="border-l-4 border-medical-200 pl-4"
                      >
                        <p className="text-sm font-medium text-medical-800 mb-1">
                          {entry.question}
                        </p>
                        <p className="text-sm text-medical-600">
                          {entry.answer}
                        </p>
                        <div className="mt-2">
                          <button
                            type="button"
                            onClick={async () => {
                              const proceed = window.confirm("Editing this answer will remove all subsequent questions and you will need to continue from here. Do you want to proceed?");
                              if (!proceed) return;
                              const next = window.prompt("Edit your answer:", entry.answer);
                              if (next === null) return;
                              try {
                                setLoading(true);
                                const res: BackendEditAnswerResponse = await editAnswerBackend({
                                  patient_id: patientId,
                                  visit_id: visitId,
                                  question_number: index + 1,
                                  new_answer: next,
                                });
                                // Keep answers up to edited index, replace edited answer, drop subsequent
                                const kept = history.slice(0, index);
                                const updatedAtIndex = { question: history[index].question, answer: next };
                                const newHistory = [...kept, updatedAtIndex];
                                setHistory(newHistory);
                                // Update progress metrics and next question based on backend regeneration
                                if (typeof res.question_count === "number") setQuestionCount(res.question_count);
                                if (typeof res.max_questions === "number") setMaxQuestions(res.max_questions);
                                if (typeof res.completion_percent === "number") setCompletionPercent(res.completion_percent);
                                setCurrentQuestion(res.next_question || "");
                                setLastAiQuestion(res.next_question || null);
                                setSubmitted(false);
                                setIntakeStatus("in_progress");
                              } catch (e) {
                                setError("Failed to edit answer. Please try again.");
                              } finally {
                                setLoading(false);
                              }
                            }}
                            className="text-xs text-blue-600 hover:underline"
                          >
                            Edit answer
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default EnhancedIntakeForm;
