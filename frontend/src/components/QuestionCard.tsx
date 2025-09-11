
import React, { useState } from 'react';

interface QuestionCardProps {
  prompt: string;
  inputType: 'text';
  onSubmit: (answer: string) => void;
  isLoading: boolean;
  questionNumber: number;
}

const QuestionCard: React.FC<QuestionCardProps> = ({
  prompt,
  inputType,
  onSubmit,
  isLoading,
  questionNumber
}) => {
  const [answer, setAnswer] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!answer.trim() || isLoading) return;
    
    onSubmit(answer.trim());
    setAnswer(''); // Clear for next question
  };

  return (
    <div className="w-full max-w-md mx-auto bg-white rounded-xl shadow-lg border border-gray-100 p-6">
      {/* Progress indicator */}
      <div className="mb-6">
        <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
          <span>Question {questionNumber} / 10</span>
          <span>{Math.round((questionNumber / 10) * 100)}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className="h-2 rounded-full transition-all duration-300"
            style={{ 
              width: `${Math.min((questionNumber / 10) * 100, 100)}%`,
              backgroundColor: '#2E86AB'
            }}
          ></div>
        </div>
      </div>

      {/* Question form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-gray-800 font-medium mb-3 text-lg leading-relaxed">
            {prompt}
          </label>
          <input
            type="text"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            className="w-full px-4 py-3 text-base border-2 border-gray-200 rounded-lg focus:border-[#2E86AB] focus:ring-2 focus:ring-[#2E86AB]/20 focus:outline-none transition-all duration-200"
            placeholder="Type your answer here..."
            required
            disabled={isLoading}
          />
        </div>
        
        <button
          type="submit"
          disabled={isLoading || !answer.trim()}
          className="w-full flex items-center justify-center gap-2 py-3 px-6 text-white font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/50 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ 
            backgroundColor: '#2E86AB',
          }}
          onMouseEnter={(e) => {
            if (!isLoading && answer.trim()) {
              e.currentTarget.style.backgroundColor = '#1e5f7a';
            }
          }}
          onMouseLeave={(e) => {
            if (!isLoading && answer.trim()) {
              e.currentTarget.style.backgroundColor = '#2E86AB';
            }
          }}
        >
          {isLoading ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              Processing...
            </>
          ) : (
            'Next'
          )}
        </button>
      </form>
    </div>
  );
};

export default QuestionCard;
