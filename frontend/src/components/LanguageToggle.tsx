import React from 'react';
import { Button } from './ui/button';

export type Language = 'en' | 'sp';

interface LanguageToggleProps {
  selectedLanguage: Language;
  onLanguageChange: (language: Language) => void;
  className?: string;
}

export const LanguageToggle: React.FC<LanguageToggleProps> = ({
  selectedLanguage,
  onLanguageChange,
  className = ''
}) => {
  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      <span className="text-sm text-gray-600 font-medium">Language:</span>
      <div className="flex bg-gray-100 rounded-lg p-1">
        <Button
          variant={selectedLanguage === 'en' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => onLanguageChange('en')}
          className={`px-3 py-1 text-xs font-medium transition-all duration-200 ${
            selectedLanguage === 'en'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          🇺🇸 English
        </Button>
        <Button
          variant={selectedLanguage === 'sp' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => onLanguageChange('sp')}
          className={`px-3 py-1 text-xs font-medium transition-all duration-200 ${
            selectedLanguage === 'sp'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          🇪🇸 Español
        </Button>
      </div>
    </div>
  );
};

export default LanguageToggle;