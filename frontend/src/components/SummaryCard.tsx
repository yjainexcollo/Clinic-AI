import React from "react";

interface SummaryCardProps {
  summary: string;
}

const SummaryCard: React.FC<SummaryCardProps> = ({ summary }) => {
  return (
    <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
      <h2 className="text-xl font-semibold mb-4 text-center">Intake Summary</h2>
      <div className="text-gray-800 whitespace-pre-line mb-4">{summary}</div>
      <div className="text-xs text-gray-500 text-center">Thank you for completing your intake.</div>
    </div>
  );
};

export default SummaryCard; 