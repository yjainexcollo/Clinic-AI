
import React from 'react';

interface CompletionCardProps {
  summary: string;
  onRestart: () => void;
}

const CompletionCard: React.FC<CompletionCardProps> = ({ summary, onRestart }) => {
  return (
    <div className="w-full max-w-md mx-auto bg-white rounded-xl shadow-lg border border-gray-100 p-6">
      <div className="text-center mb-6">
        <div 
          className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
          style={{ backgroundColor: '#2E86AB' }}
        >
          <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Intake Complete
        </h2>
      </div>

      <div className="bg-gray-50 rounded-lg p-4 mb-6">
        <h3 className="font-semibold text-gray-800 mb-3">
          Intake Summary (Demo)
        </h3>
        <div className="text-gray-700 whitespace-pre-line text-sm leading-relaxed">
          {summary}
        </div>
      </div>

      <button
        onClick={onRestart}
        className="w-full py-3 px-6 text-white font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/50"
        style={{ backgroundColor: '#2E86AB' }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = '#1e5f7a';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = '#2E86AB';
        }}
      >
        Start New Intake
      </button>
    </div>
  );
};

export default CompletionCard;
