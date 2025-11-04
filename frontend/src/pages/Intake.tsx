import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { apiClient } from '../lib/api';
import { useAppStore } from '../lib/store';
import { Button } from '../components/ui/Button';
import { Loading } from '../components/ui/Loading';
import { Send, Upload, X, Edit2, Check, MessageCircle, CheckCircle2, ArrowLeft } from 'lucide-react';

interface QuestionAnswer {
  question: string;
  answer: string;
  questionNumber: number;
  timestamp: Date;
}

export const Intake: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentPatient, currentVisit, addIntakeAnswer } = useAppStore();
  
  const [currentQuestion, setCurrentQuestion] = useState<string>(
    location.state?.first_question || ''
  );
  const [answer, setAnswer] = useState('');
  const [questions, setQuestions] = useState<QuestionAnswer[]>([]);
  const [isComplete, setIsComplete] = useState(false);
  const [completionPercent, setCompletionPercent] = useState(0);
  const [allowsImageUpload, setAllowsImageUpload] = useState(false);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingValue, setEditingValue] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const answerInputRef = useRef<HTMLTextAreaElement>(null);

  const patientId = currentPatient?.patient_id || location.state?.patient_id;
  const visitId = currentVisit?.visit_id || location.state?.visit_id;

  // Get intake status
  const { data: intakeStatus } = useQuery({
    queryKey: ['intake-status', patientId, visitId],
    queryFn: () => apiClient.getIntakeStatus(patientId!, visitId!),
    enabled: !!patientId && !!visitId,
    refetchInterval: 30000,
  });

  // Restore session on mount
  useEffect(() => {
    if (intakeStatus?.success && intakeStatus.data) {
      const status = intakeStatus.data;
      
      if (status.questions_asked && status.questions_asked.length > 0) {
        const restoredQuestions: QuestionAnswer[] = status.questions_asked.map((qa: any) => ({
          question: qa.question,
          answer: qa.answer,
          questionNumber: qa.question_number || 0,
          timestamp: new Date(qa.timestamp || Date.now()),
        }));
        setQuestions(restoredQuestions);
        
        if (status.pending_question) {
          setCurrentQuestion(status.pending_question);
        }
      }
      
      if (status.intake_status === 'completed') {
        setIsComplete(true);
      }
      
      if (status.total_questions && status.max_questions) {
        setCompletionPercent(Math.round((status.total_questions / status.max_questions) * 100));
      }
    }
  }, [intakeStatus]);

  useEffect(() => {
    if (!patientId || !visitId) {
      navigate('/');
    }
  }, [patientId, visitId, navigate]);

  useEffect(() => {
    if (answerInputRef.current && currentQuestion && !isComplete) {
      answerInputRef.current.focus();
    }
  }, [currentQuestion, isComplete]);

  const answerMutation = useMutation({
    mutationFn: async (data: { answer: string; files?: File[] }) => {
      return apiClient.answerIntake(
        {
          patient_id: patientId!,
          visit_id: visitId!,
          answer: data.answer,
        },
        data.files
      );
    },
    onSuccess: (response) => {
      if (response.success && response.data) {
        const newQA: QuestionAnswer = {
          question: currentQuestion,
          answer: answer.trim(),
          questionNumber: questions.length + 1,
          timestamp: new Date(),
        };
        
        setQuestions([...questions, newQA]);
        addIntakeAnswer(currentQuestion, answer.trim());
        
        setCompletionPercent(
          response.data.completion_percent ?? 
          (response.data.question_count && response.data.max_questions
            ? Math.round((response.data.question_count / response.data.max_questions) * 100)
            : 0)
        );
        setAllowsImageUpload(response.data.allows_image_upload ?? false);

        if (response.data.is_complete) {
          setIsComplete(true);
          toast.success('Intake completed successfully!');
          setTimeout(() => {
            navigate('/pre-visit-summary', {
              state: { patient_id: patientId, visit_id: visitId },
            });
          }, 2000);
        } else if (response.data.next_question) {
          setCurrentQuestion(response.data.next_question);
          setAnswer('');
          setImageFiles([]);
          toast.success('Answer submitted!');
        }
      } else {
        toast.error(response.error || 'Failed to submit answer');
      }
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to submit answer. Please try again.');
    },
  });

  const editAnswerMutation = useMutation({
    mutationFn: async (data: { questionNumber: number; newAnswer: string }) => {
      return apiClient.editIntakeAnswer(patientId!, visitId!, {
        question: questions[data.questionNumber - 1].question,
        old_answer: questions[data.questionNumber - 1].answer,
        new_answer: data.newAnswer,
      });
    },
    onSuccess: (response) => {
      if (response.success && response.data) {
        setQuestions((prev) =>
          prev.map((qa, i) =>
            i === editingIndex! - 1 ? { ...qa, answer: editingValue.trim() } : qa
          )
        );
        
        if (response.data.next_question) {
          setCurrentQuestion(response.data.next_question);
        }
        
        setEditingIndex(null);
        setEditingValue('');
        toast.success('Answer updated successfully');
      } else {
        toast.error(response.error || 'Failed to update answer');
      }
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!answer.trim() || answerMutation.isPending) return;

    answerMutation.mutate({
      answer: answer.trim(),
      files: imageFiles.length > 0 ? imageFiles : undefined,
    });
  };

  const handleEdit = (index: number) => {
    if (window.confirm('Editing this answer will remove all subsequent questions. Continue?')) {
      setEditingIndex(index);
      setEditingValue(questions[index - 1].answer);
    }
  };

  const handleSaveEdit = () => {
    if (!editingValue.trim() || editingIndex === null) return;
    editAnswerMutation.mutate({
      questionNumber: editingIndex,
      newAnswer: editingValue.trim(),
    });
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setImageFiles((prev) => [...prev, ...files]);
    toast.success(`${files.length} image(s) selected!`);
  };

  const removeImage = (index: number) => {
    setImageFiles((prev) => prev.filter((_, i) => i !== index));
  };

  if (!patientId || !visitId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#e6f3f8] to-gray-50">
        <Loading message="Redirecting..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#e6f3f8] to-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate('/')}
            className="inline-flex items-center text-gray-600 hover:text-gray-900 transition-colors mb-6 group"
          >
            <ArrowLeft className="h-4 w-4 mr-2 group-hover:-translate-x-1 transition-transform" />
            Back to Home
          </button>
          
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">Clinical Intake</h1>
              <p className="text-gray-600">
                {isComplete ? 'Intake Complete!' : 'Answer the questions to complete your intake'}
              </p>
            </div>
            {currentPatient && (
              <div className="hidden sm:block text-right">
                <p className="text-sm text-gray-500">Patient</p>
                <p className="font-semibold text-gray-900">{currentPatient.name}</p>
              </div>
            )}
          </div>

          {/* Progress Bar */}
          {!isComplete && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-gray-700">
                  Question {questions.length + 1}
                </span>
                <span className="text-gray-600">{completionPercent}% Complete</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                <div
                  className="h-full bg-[#2E86AB] rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${completionPercent}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Completion Card */}
        {isComplete && (
          <div className="medical-card text-center mb-8">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="w-10 h-10 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">
              Thank you, {currentPatient?.name || 'patient'}!
            </h2>
            <p className="text-gray-700 mb-6 text-lg">
              Your intake session is complete. Redirecting to your summary...
            </p>
            <Loading message="Preparing your summary..." />
          </div>
        )}

        {/* Current Question Form */}
        {!isComplete && currentQuestion && (
          <div className="medical-card mb-8">
            <div className="space-y-6">
              <div>
                <div className="flex items-center space-x-2 mb-4">
                  <div className="w-10 h-10 bg-[#2E86AB] rounded-lg flex items-center justify-center">
                    <span className="text-white font-bold">{questions.length + 1}</span>
                  </div>
                  <h2 className="text-lg font-semibold text-gray-900">Current Question</h2>
                </div>
                <p className="text-gray-800 text-lg leading-relaxed mb-6 pl-12">
                  {currentQuestion}
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label htmlFor="answer" className="block text-sm font-medium text-gray-700 mb-2">
                    Your Answer
                  </label>
                  <textarea
                    id="answer"
                    ref={answerInputRef}
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                    rows={5}
                    className="medical-textarea"
                    placeholder="Type your answer here..."
                    disabled={answerMutation.isPending}
                    required
                  />
                </div>

                {allowsImageUpload && (
                  <div className="border-t border-gray-200 pt-6">
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      <Upload className="h-4 w-4 inline mr-2" />
                      Upload Medication Images (Optional)
                    </label>
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleImageSelect}
                      className="hidden"
                      multiple
                      accept="image/*"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full sm:w-auto"
                      disabled={answerMutation.isPending}
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Select Images
                    </Button>
                    {imageFiles.length > 0 && (
                      <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {imageFiles.map((file, index) => (
                          <div key={index} className="relative bg-gray-50 rounded-lg p-3 border border-gray-200">
                            <p className="text-xs text-gray-700 truncate mb-2">{file.name}</p>
                            <button
                              type="button"
                              onClick={() => removeImage(index)}
                              className="absolute top-2 right-2 p-1 bg-red-100 hover:bg-red-200 rounded-full transition-colors"
                              disabled={answerMutation.isPending}
                            >
                              <X className="h-3 w-3 text-red-600" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div className="flex justify-end pt-4 border-t border-gray-200">
                  <Button
                    type="submit"
                    disabled={!answer.trim() || answerMutation.isPending}
                    size="lg"
                    className="min-w-[140px]"
                    isLoading={answerMutation.isPending}
                  >
                    {!answerMutation.isPending && <Send className="h-4 w-4 mr-2" />}
                    Submit Answer
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Previous Answers */}
        {!isComplete && questions.length > 0 && (
          <div className="medical-card">
            <div className="flex items-center space-x-2 mb-6">
              <MessageCircle className="h-5 w-5 text-[#2E86AB]" />
              <h3 className="text-lg font-semibold text-gray-900">Previous Answers</h3>
            </div>
            <div className="space-y-4">
              {questions.map((qa, idx) => (
                <div key={idx} className="bg-gray-50 rounded-lg p-5 border border-gray-200">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <span className="text-sm font-medium text-gray-500">Q{qa.questionNumber}</span>
                        <span className="text-xs text-gray-400">•</span>
                        <span className="text-xs text-gray-500">
                          {qa.timestamp.toLocaleTimeString()}
                        </span>
                      </div>
                      <p className="text-sm font-medium text-gray-700 mb-2">{qa.question}</p>
                    </div>
                    {editingIndex === qa.questionNumber ? (
                      <div className="flex space-x-2 ml-4">
                        <button
                          type="button"
                          onClick={handleSaveEdit}
                          disabled={!editingValue.trim() || editAnswerMutation.isPending}
                          className="p-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors disabled:opacity-50"
                        >
                          <Check className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingIndex(null);
                            setEditingValue('');
                          }}
                          className="p-2 bg-gray-300 hover:bg-gray-400 text-white rounded-lg transition-colors"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleEdit(qa.questionNumber)}
                        className="p-2 text-[#2E86AB] hover:bg-[#e6f3f8] rounded-lg transition-colors ml-4"
                        disabled={answerMutation.isPending}
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  {editingIndex === qa.questionNumber ? (
                    <textarea
                      value={editingValue}
                      onChange={(e) => setEditingValue(e.target.value)}
                      rows={3}
                      className="medical-textarea text-sm"
                    />
                  ) : (
                    <p className="text-gray-800 whitespace-pre-wrap text-sm">{qa.answer}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {!isComplete && !currentQuestion && (
          <div className="medical-card text-center">
            <Loading message="Loading question..." />
          </div>
        )}
      </div>
    </div>
  );
};
