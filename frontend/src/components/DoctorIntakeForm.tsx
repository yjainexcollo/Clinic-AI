import React, { useEffect, useState } from "react";
import { postIntake, IntakeResponse } from "../utils/api";
import { getSessionId } from "../utils/uuid";
import SummaryCard from "./SummaryCard";

type HistoryEntry = {
  question: string;
  answer: string;
};

const TOTAL_QUESTIONS = 10;
const FIRST_QUESTION = "What type of health issue are you facing right now?";

const DoctorIntakeForm: React.FC = () => {
  const [sessionId] = useState(getSessionId());
  const [currentQuestion, setCurrentQuestion] =
    useState<string>(FIRST_QUESTION);
  const [currentType, setCurrentType] = useState<string>("text");
  const [summary, setSummary] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [aiStarted, setAiStarted] = useState(false);
  const [lastAiQuestion, setLastAiQuestion] = useState<string | null>(null);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !currentQuestion) return;
    setLoading(true);
    setError(null);
    const answer = input;
    setInput("");
    try {
      // If this is the first question, send only session_id and the answer
      if (!aiStarted) {
        setHistory([{ question: FIRST_QUESTION, answer }]);
        // Now call backend to get the first AI question
        const res: IntakeResponse = await postIntake({
          session_id: sessionId,
          last_question: FIRST_QUESTION,
          last_answer: answer,
        });
        setCurrentQuestion(res.next_question);
        setCurrentType(res.type);
        setSummary(res.summary);
        setAiStarted(true);
        setLastAiQuestion(res.next_question);
      } else {
        // AI-driven follow-ups
        const last_question = lastAiQuestion;
        const last_answer = answer;
        const newHistory = [
          ...history,
          { question: last_question || "", answer: last_answer },
        ];

        const res: IntakeResponse = await postIntake({
          session_id: sessionId,
          last_question,
          last_answer,
        });
        setHistory(newHistory);
        setCurrentQuestion(res.next_question);
        setCurrentType(res.type);
        setSummary(res.summary);
        setLastAiQuestion(res.next_question);

        // Check if AI has determined the conversation is complete
        if (
          res.next_question === "COMPLETE" ||
          res.next_question === null ||
          res.next_question === ""
        ) {
          setSubmitted(true);
        }
      }
    } catch {
      setError("Failed to submit answer. Please try again.");
      setInput(answer); // restore input
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = () => {
    setError(null);
    setCurrentQuestion(FIRST_QUESTION);
    setCurrentType("text");
    setSummary(null);
    setHistory([]);
    setInput("");
    setSubmitted(false);
    setAiStarted(false);
    setLastAiQuestion(null);
  };

  if (
    (summary &&
      (currentQuestion === "COMPLETE" ||
        currentQuestion === null ||
        currentQuestion === "")) ||
    submitted
  ) {
    return (
      <div className="max-w-lg mx-auto mt-8">
        <SummaryCard
          summary={summary || "Thank you for submitting your intake form."}
        />
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto mt-8">
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4 flex items-center justify-between">
          <span>{error}</span>
          <button
            className="ml-4 px-3 py-1 bg-red-200 rounded hover:bg-red-300 transition"
            onClick={handleRetry}
            disabled={loading}
            type="button"
          >
            Retry
          </button>
        </div>
      )}
      <div className="mb-4 text-sm text-gray-500">
        Question {Math.min(history.length + 1, TOTAL_QUESTIONS)} /{" "}
        {TOTAL_QUESTIONS}
      </div>
      {currentQuestion && !submitted && (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="font-medium text-lg mb-2">{currentQuestion}</div>
          {currentType === "text" && (
            <input
              className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={loading}
              autoFocus
            />
          )}
          <button
            className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 transition disabled:opacity-50"
            type="submit"
            disabled={loading || !input.trim()}
          >
            {loading ? "Loading..." : "Submit"}
          </button>
        </form>
      )}
      <div className="mt-6">
        {history.map((entry, idx) => (
          <div key={idx} className="mb-2">
            <div className="text-gray-700 font-semibold">
              Q: {entry.question}
            </div>
            <div className="text-gray-900 ml-2">A: {entry.answer}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DoctorIntakeForm;
