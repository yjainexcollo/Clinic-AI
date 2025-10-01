import React, { useState } from "react";
import { X, Plus } from "lucide-react";

interface SymptomSelectorProps {
  selectedSymptoms: string[];
  onSymptomsChange: (symptoms: string[]) => void;
  placeholder?: string;
  language?: 'en' | 'sp';
}

// Common symptoms for intake form
const SYMPTOM_CATEGORIES = {
  en: [
    "Fever",
    "Cough / Cold",
    "Headache",
    "Stomach Pain",
    "Chest Pain",
    "Breathing Difficulty",
    "Fatigue / Weakness",
    "Body Pain",
    "Joint Pain",
    "Skin Rash",
    "Itching",
    "Diabetes"
  ],
  sp: [
    "Fiebre",
    "Tos / Resfriado",
    "Dolor de Cabeza",
    "Dolor de Estómago",
    "Dolor en el Pecho",
    "Dificultad para Respirar",
    "Fatiga / Debilidad",
    "Dolor Corporal",
    "Dolor Articular",
    "Erupción Cutánea",
    "Picazón",
    "Diabetes"
  ]
};

const SymptomSelector: React.FC<SymptomSelectorProps> = ({
  selectedSymptoms,
  onSymptomsChange,
  placeholder = "Select your symptoms...",
  language = 'en'
}) => {
  const [customSymptom, setCustomSymptom] = useState("");
  
  // Get symptoms based on language
  const symptoms = SYMPTOM_CATEGORIES[language] || SYMPTOM_CATEGORIES.en;

  // Toggle symptom selection
  const toggleSymptom = (symptom: string) => {
    if (selectedSymptoms.includes(symptom)) {
      onSymptomsChange(selectedSymptoms.filter(s => s !== symptom));
    } else {
      onSymptomsChange([...selectedSymptoms, symptom]);
    }
  };

  // Add custom symptom
  const addCustomSymptom = () => {
    const trimmedSymptom = customSymptom.trim();
    if (trimmedSymptom && !selectedSymptoms.includes(trimmedSymptom)) {
      onSymptomsChange([...selectedSymptoms, trimmedSymptom]);
      setCustomSymptom("");
    }
  };

  // Remove symptom
  const removeSymptom = (symptomToRemove: string) => {
    onSymptomsChange(selectedSymptoms.filter(symptom => symptom !== symptomToRemove));
  };

  // Handle custom symptom key press
  const handleCustomKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addCustomSymptom();
    }
  };

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {language === 'sp' ? 'Síntomas *' : 'Symptoms *'}
      </label>
      
      {/* Selected symptoms display */}
      {selectedSymptoms.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {selectedSymptoms.map((symptom) => (
            <span
              key={symptom}
              className="inline-flex items-center gap-1 px-3 py-1 bg-medical-primary text-white text-sm rounded-full"
            >
              {symptom}
              <button
                type="button"
                onClick={() => removeSymptom(symptom)}
                className="hover:bg-medical-primary-hover rounded-full p-0.5 transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Symptom options (no category heading) */}
      <div className="max-h-96 overflow-y-auto border border-gray-200 rounded-lg p-4 bg-gray-50">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {symptoms.map((symptom) => (
            <button
              key={symptom}
              type="button"
              onClick={() => toggleSymptom(symptom)}
              className={`p-2 text-sm rounded-md border transition-all duration-200 text-left ${
                selectedSymptoms.includes(symptom)
                  ? 'bg-medical-primary text-white border-medical-primary shadow-md'
                  : 'bg-white text-gray-700 border-gray-300 hover:border-medical-primary hover:bg-medical-primary-light'
              }`}
            >
              {symptom}
            </button>
          ))}
        </div>
      </div>

      {/* Custom symptom input */}
      <div className="mt-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={customSymptom}
            onChange={(e) => setCustomSymptom(e.target.value)}
            onKeyPress={handleCustomKeyPress}
            placeholder={language === 'sp' ? 'Añadir síntoma personalizado...' : 'Add custom symptom...'}
            className="medical-input flex-1"
          />
          <button
            type="button"
            onClick={addCustomSymptom}
            disabled={!customSymptom.trim()}
            className="medical-button px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Helper text */}
      <p className="mt-2 text-xs text-gray-500">
        {language === 'sp' ? 'Haga clic en los síntomas para seleccionarlos.' : 'Click on symptoms to select them.'}
      </p>
    </div>
  );
};

export default SymptomSelector;