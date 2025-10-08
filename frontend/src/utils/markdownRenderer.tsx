import React from 'react';

/**
 * Utility function to render markdown-formatted text with proper styling
 * Handles basic markdown formatting like **bold** text
 */
export const renderMarkdownText = (text: string): React.ReactNode => {
  if (!text) return <div className="text-gray-500 italic">No content available</div>;
  
  const lines = text.split(/\n+/);
  return (
    <div className="space-y-4">
      {lines.map((line, idx) => {
        const key = `l-${idx}`;
        const trimmedLine = line.trim();
        
        // Skip empty lines
        if (!trimmedLine) return null;
        
        // Handle markdown bold formatting (**text**)
        if (trimmedLine.includes('**')) {
          const parts = trimmedLine.split(/(\*\*.*?\*\*)/g);
          return (
            <div key={key} className="mb-3">
              {parts.map((part, partIdx) => {
                if (part.startsWith('**') && part.endsWith('**')) {
                  // Remove ** and make it bold
                  const boldText = part.slice(2, -2);
                  return <strong key={partIdx} className="text-gray-900 font-semibold">{boldText}</strong>;
                }
                return <span key={partIdx}>{part}</span>;
              })}
            </div>
          );
        }
        
        // Handle regular lines
        return (
          <div key={key} className="text-gray-700 leading-relaxed">
            {trimmedLine}
          </div>
        );
      })}
    </div>
  );
};

/**
 * Simple markdown renderer for inline text (single line)
 */
export const renderInlineMarkdown = (text: string): React.ReactNode => {
  if (!text) return null;
  
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return (
    <>
      {parts.map((part, idx) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          const boldText = part.slice(2, -2);
          return <strong key={idx} className="font-semibold">{boldText}</strong>;
        }
        return <span key={idx}>{part}</span>;
      })}
    </>
  );
};