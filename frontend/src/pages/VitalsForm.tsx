import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { storeVitals, getVitals, VitalsData } from "../services/patientService";
import { useLanguage } from "../contexts/LanguageContext";
import { workflowService } from "../services/workflowService";

// VitalsData interface is imported from patientService

const VitalsForm: React.FC = () => {
  const { patientId = "", visitId = "" } = useParams();
  const navigate = useNavigate();
  const { language, t } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [bmi, setBmi] = useState<number | null>(null);
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);
  const [isWalkInPatient, setIsWalkInPatient] = useState(false);
  const [workflowInfo, setWorkflowInfo] = useState<any>(null);

  const [vitals, setVitals] = useState<VitalsData>({
    systolic: "",
    diastolic: "",
    bpArm: "",
    bpPosition: "",
    heartRate: "",
    rhythm: "",
    respiratoryRate: "",
    temperature: "",
    tempUnit: "°C",
    tempMethod: "",
    oxygenSaturation: "",
    height: "",
    heightUnit: "cm",
    weight: "",
    weightUnit: "kg",
    painScore: "",
    notes: "",
  });

  // Detect workflow type and fetch workflow info
  useEffect(() => {
    const fetchWorkflowInfo = async () => {
      if (!visitId) return;
      
      try {
        const stepsResponse = await workflowService.getAvailableSteps(visitId);
        setWorkflowInfo(stepsResponse);
        
        // Determine if this is a walk-in patient based on available steps
        if (stepsResponse.available_steps.includes("vitals")) {
          setIsWalkInPatient(true);
        } else {
          setIsWalkInPatient(false);
        }
      } catch (error) {
        console.error("Error fetching workflow info:", error);
        // Default to scheduled workflow if we can't determine
        setIsWalkInPatient(false);
      }
    };

    fetchWorkflowInfo();
  }, [visitId]);

  // Calculate BMI when height and weight change
  useEffect(() => {
    if (vitals.height && vitals.weight) {
      const heightInM = vitals.heightUnit === "cm" 
        ? parseFloat(vitals.height) / 100 
        : parseFloat(vitals.height) * 0.3048; // Convert feet to meters
      
      const weightInKg = vitals.weightUnit === "kg" 
        ? parseFloat(vitals.weight) 
        : parseFloat(vitals.weight) * 0.453592; // Convert lbs to kg
      
      if (heightInM > 0 && weightInKg > 0) {
        const bmiValue = weightInKg / (heightInM * heightInM);
        setBmi(Math.round(bmiValue * 10) / 10);
      }
    } else {
      setBmi(null);
    }
  }, [vitals.height, vitals.weight, vitals.heightUnit, vitals.weightUnit]);

  // Check if vitals already exist for this patient/visit
  useEffect(() => {
    (async () => {
      try {
        if (!patientId || !visitId) return;
        const existing = await getVitals(patientId, visitId);
        if (existing) {
          setVitals(existing);
          setAlreadySubmitted(true);
        }
      } catch {
        // no existing vitals
      }
    })();
  }, [patientId, visitId]);

  const handleInputChange = (field: keyof VitalsData, value: string) => {
    setVitals(prev => ({ ...prev, [field]: value }));
  };

  const formatVitalsForSOAP = (): string => {
    const parts: string[] = [];
    
    if (language === 'sp') {
      // Blood Pressure
      if (vitals.systolic && vitals.diastolic) {
        let bpText = `Presión arterial ${vitals.systolic}/${vitals.diastolic} mmHg`;
        if (vitals.bpArm) bpText += ` (brazo ${vitals.bpArm})`;
        if (vitals.bpPosition) bpText += ` (${vitals.bpPosition})`;
        parts.push(bpText);
      }
      
      // Heart Rate
      if (vitals.heartRate) {
        let hrText = `Frecuencia cardíaca ${vitals.heartRate} lpm`;
        if (vitals.rhythm) hrText += ` (${vitals.rhythm})`;
        parts.push(hrText);
      }
      
      // Respiratory Rate
      if (vitals.respiratoryRate) {
        parts.push(`Frecuencia respiratoria ${vitals.respiratoryRate} respiraciones/min`);
      }
      
      // Temperature
      if (vitals.temperature) {
        let tempText = `Temperatura ${vitals.temperature}${vitals.tempUnit}`;
        if (vitals.tempMethod) tempText += ` (${vitals.tempMethod})`;
        parts.push(tempText);
      }
      
      // Oxygen Saturation
      if (vitals.oxygenSaturation) {
        parts.push(`SpO₂ ${vitals.oxygenSaturation}% en aire ambiente`);
      }
      
      // Height, Weight, BMI
      if (vitals.height && vitals.weight) {
        const heightText = vitals.heightUnit === "cm" 
          ? `${vitals.height} cm` 
          : `${vitals.height} ft/in`;
        const weightText = vitals.weightUnit === "kg" 
          ? `${vitals.weight} kg` 
          : `${vitals.weight} lbs`;
        
        let vitalsText = `Altura ${heightText}, Peso ${weightText}`;
        if (bmi) vitalsText += `, IMC ${bmi}`;
        parts.push(vitalsText);
      }
      
      // Pain Score
      if (vitals.painScore) {
        parts.push(`Escala de dolor ${vitals.painScore}/10`);
      }
    } else {
      // Blood Pressure
      if (vitals.systolic && vitals.diastolic) {
        let bpText = `Blood pressure ${vitals.systolic}/${vitals.diastolic} mmHg`;
        if (vitals.bpArm) bpText += ` (${vitals.bpArm} arm)`;
        if (vitals.bpPosition) bpText += ` (${vitals.bpPosition})`;
        parts.push(bpText);
      }
      
      // Heart Rate
      if (vitals.heartRate) {
        let hrText = `Heart rate ${vitals.heartRate} bpm`;
        if (vitals.rhythm) hrText += ` (${vitals.rhythm})`;
        parts.push(hrText);
      }
      
      // Respiratory Rate
      if (vitals.respiratoryRate) {
        parts.push(`Respiratory rate ${vitals.respiratoryRate} breaths/min`);
      }
      
      // Temperature
      if (vitals.temperature) {
        let tempText = `Temperature ${vitals.temperature}${vitals.tempUnit}`;
        if (vitals.tempMethod) tempText += ` (${vitals.tempMethod})`;
        parts.push(tempText);
      }
      
      // Oxygen Saturation
      if (vitals.oxygenSaturation) {
        parts.push(`SpO₂ ${vitals.oxygenSaturation}% on room air`);
      }
      
      // Height, Weight, BMI
      if (vitals.height && vitals.weight) {
        const heightText = vitals.heightUnit === "cm" 
          ? `${vitals.height} cm` 
          : `${vitals.height} ft/in`;
        const weightText = vitals.weightUnit === "kg" 
          ? `${vitals.weight} kg` 
          : `${vitals.weight} lbs`;
        
        let vitalsText = `Height ${heightText}, Weight ${weightText}`;
        if (bmi) vitalsText += `, BMI ${bmi}`;
        parts.push(vitalsText);
      }
      
      // Pain Score
      if (vitals.painScore) {
        parts.push(`Pain score ${vitals.painScore}/10`);
      }
    }
    
    return parts.join(", ") + ".";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientId || !visitId) {
      setError("Missing patient or visit ID");
      return;
    }

    setLoading(true);
    setError("");

    try {
      // Normalize optional/number fields to satisfy backend schema
      const sendVitals: any = {
        ...vitals,
        systolic: Number(vitals.systolic),
        diastolic: Number(vitals.diastolic),
        heartRate: Number(vitals.heartRate),
        respiratoryRate: vitals.respiratoryRate !== "" && vitals.respiratoryRate != null ? Number(vitals.respiratoryRate) : undefined,
        temperature: Number(vitals.temperature),
        oxygenSaturation: Number(vitals.oxygenSaturation),
        weight: Number(vitals.weight),
        height: vitals.height ? Number(vitals.height) : undefined,
        painScore: vitals.painScore !== "" ? Number(vitals.painScore) : undefined,
        tempUnit: vitals.tempUnit === "°F" ? "F" : vitals.tempUnit === "°C" ? "C" : vitals.tempUnit,
      };

      // Store vitals data to backend
      await storeVitals(patientId, visitId, sendVitals);
      try {
        localStorage.setItem(`vitals_done_${patientId}_${visitId}`, '1');
      } catch {}
      setAlreadySubmitted(true);

      // Redirect back to intake page after vitals submission (scheduled flow)
      // The intake page has transcription upload functionality built-in
      const effectiveVisitId = visitId || (patientId ? localStorage.getItem(`visit_${patientId}`) : null);
      if (patientId && effectiveVisitId) {
        // Check URL params for walkin flag, or use state
        const urlParams = new URLSearchParams(window.location.search);
        const isWalkIn = isWalkInPatient || urlParams.get('walkin') === 'true';
        
        // For scheduled workflow: go back to intake page (which has transcription buttons)
        // For walk-in workflow: go back to intake page with walkin flag
        const redirectUrl = isWalkIn 
          ? `/intake/${encodeURIComponent(patientId)}?v=${encodeURIComponent(effectiveVisitId)}&walkin=true`
          : `/intake/${encodeURIComponent(patientId)}?v=${encodeURIComponent(effectiveVisitId)}&done=1`;
        
        // Show brief success message, then redirect
        setTimeout(() => {
          window.location.href = redirectUrl;
        }, 1000);
      } else {
        alert('Vitals saved successfully! However, could not determine redirect path.');
      }
    } catch (err: any) {
      setError(err.message || "Failed to save vitals");
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    if (isWalkInPatient) {
      // For walk-in, go back to workflow selector
      navigate('/workflow-selector');
    } else {
      // For scheduled, go back to pre-visit summary
      navigate('/pre-visit-summary', {
        state: { patient_id: patientId, visit_id: visitId },
      });
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {isWalkInPatient ? "Walk-in Vitals Form" : t('vitals.title')}
            </h1>
            <p className="text-sm text-gray-600 mt-2">
              {t('vitals.patient_visit', { patientId, visitId })}
            </p>
          </div>
          {isWalkInPatient && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
              Walk-in Workflow
            </span>
          )}
        </div>
        {alreadySubmitted && (
          <p className="mt-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded px-3 py-2 inline-block">
            {t('vitals.already_submitted')}
          </p>
        )}
      </div>

      {/* Workflow Status for Walk-in Patients */}
      {isWalkInPatient && workflowInfo && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
          <h3 className="text-sm font-medium text-green-800 mb-2">Current Workflow Status</h3>
          <p className="text-sm text-green-700">
            <strong>Current Step:</strong> Vitals Form
          </p>
          <p className="text-sm text-green-700">
            <strong>Next Steps:</strong> SOAP Generation → Post-Visit Summary
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Blood Pressure Section */}
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('vitals.blood_pressure')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('vitals.systolic')} *
              </label>
              <input
                type="number"
                value={vitals.systolic}
                onChange={(e) => handleInputChange("systolic", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="120"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('vitals.diastolic')} *
              </label>
              <input
                type="number"
                value={vitals.diastolic}
                onChange={(e) => handleInputChange("diastolic", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="80"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('vitals.arm_used')}
              </label>
              <select
                value={vitals.bpArm}
                onChange={(e) => handleInputChange("bpArm", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">{t('vitals.select_arm')}</option>
                <option value="Left">{t('vitals.left')}</option>
                <option value="Right">{t('vitals.right')}</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('vitals.position')}
              </label>
              <select
                value={vitals.bpPosition}
                onChange={(e) => handleInputChange("bpPosition", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">{t('vitals.select_position')}</option>
                <option value="Sitting">{t('vitals.sitting')}</option>
                <option value="Standing">{t('vitals.standing')}</option>
                <option value="Lying">{t('vitals.lying')}</option>
              </select>
            </div>
          </div>
        </div>

        {/* Heart Rate Section */}
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('vitals.heart_rate')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('vitals.bpm')} *
              </label>
              <input
                type="number"
                value={vitals.heartRate}
                onChange={(e) => handleInputChange("heartRate", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="72"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('vitals.rhythm')}
              </label>
              <select
                value={vitals.rhythm}
                onChange={(e) => handleInputChange("rhythm", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">{t('vitals.select_rhythm')}</option>
                <option value="Regular">{t('vitals.regular')}</option>
                <option value="Irregular">{t('vitals.irregular')}</option>
              </select>
            </div>
          </div>
        </div>

        {/* Respiratory Rate Section */}
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('vitals.respiratory_rate')}</h2>
          <div className="w-full md:w-1/2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('vitals.breaths_per_minute')}
            </label>
            <input
              type="number"
              value={vitals.respiratoryRate}
              onChange={(e) => handleInputChange("respiratoryRate", e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="16"
            />
          </div>
        </div>

        {/* Temperature Section */}
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('vitals.temperature')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('vitals.value')} *
              </label>
              <input
                type="number"
                step="0.1"
                value={vitals.temperature}
                onChange={(e) => handleInputChange("temperature", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="36.5"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('vitals.unit')} *
              </label>
              <select
                value={vitals.tempUnit}
                onChange={(e) => handleInputChange("tempUnit", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="C">°C</option>
                <option value="F">°F</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('vitals.method')}
              </label>
              <select
                value={vitals.tempMethod}
                onChange={(e) => handleInputChange("tempMethod", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">{t('vitals.select_method')}</option>
                <option value="Oral">{t('vitals.oral')}</option>
                <option value="Axillary">{t('vitals.axillary')}</option>
                <option value="Tympanic">{t('vitals.tympanic')}</option>
                <option value="Rectal">{t('vitals.rectal')}</option>
              </select>
            </div>
          </div>
        </div>

        {/* Oxygen Saturation Section */}
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('vitals.oxygen_saturation')}</h2>
          <div className="w-full md:w-1/2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('vitals.percent_value')} *
            </label>
            <input
              type="number"
              min="0"
              max="100"
              value={vitals.oxygenSaturation}
              onChange={(e) => handleInputChange("oxygenSaturation", e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="98"
              required
            />
          </div>
        </div>

        {/* Height and Weight Section */}
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('vitals.height_weight')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('vitals.height')}
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  step="0.1"
                  value={vitals.height}
                  onChange={(e) => handleInputChange("height", e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="170"
                  
                />
                <select
                  value={vitals.heightUnit}
                  onChange={(e) => handleInputChange("heightUnit", e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="cm">cm</option>
                  <option value="ft/in">ft/in</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('vitals.weight')} *
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  step="0.1"
                  value={vitals.weight}
                  onChange={(e) => handleInputChange("weight", e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="70"
                  required
                />
                <select
                  value={vitals.weightUnit}
                  onChange={(e) => handleInputChange("weightUnit", e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="kg">kg</option>
                  <option value="lbs">lbs</option>
                </select>
              </div>
            </div>
          </div>
          {bmi && (
            <div className="mt-4 p-3 bg-blue-50 rounded-md">
              <span className="text-sm font-medium text-blue-900">
                {t('vitals.calculated_bmi')} <strong>{bmi}</strong>
              </span>
            </div>
          )}
        </div>

        {/* Pain Score Section */}
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('vitals.pain_score')}</h2>
          <div className="w-full md:w-1/2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('vitals.numeric_scale')}
            </label>
            <input
              type="number"
              min="0"
              max="10"
              value={vitals.painScore}
              onChange={(e) => handleInputChange("painScore", e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="0"
            />
            <p className="text-xs text-gray-500 mt-1">
              {t('vitals.pain_scale')}
            </p>
          </div>
        </div>

        {/* Additional Notes */}
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('vitals.additional_notes')}</h2>
          <textarea
            value={vitals.notes}
            onChange={(e) => handleInputChange("notes", e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={4}
            placeholder={t('vitals.notes_placeholder')}
          />
        </div>

        {/* Preview */}
        <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('vitals.preview')}</h2>
          <div className="text-sm text-gray-700 bg-white p-4 rounded border">
            {formatVitalsForSOAP() || t('vitals.preview_placeholder')}
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-4 justify-end">
          <button
            type="button"
            onClick={handleCancel}
            className="px-6 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500"
          >
            {t('vitals.cancel')}
          </button>
          <button
            type="submit"
            disabled={loading || alreadySubmitted}
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {alreadySubmitted ? t('vitals.already_submitted_btn') : (loading ? t('vitals.saving') : t('vitals.save'))}
          </button>
        </div>
      </form>
    </div>
  );
};

export default VitalsForm;