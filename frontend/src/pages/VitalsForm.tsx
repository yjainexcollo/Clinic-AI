import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getSoapNote, generateSoapNote, storeVitals, getVitals, VitalsData } from "../services/patientService";

// VitalsData interface is imported from patientService

const VitalsForm: React.FC = () => {
  const { patientId = "", visitId = "" } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [bmi, setBmi] = useState<number | null>(null);
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);

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
        respiratoryRate: Number(vitals.respiratoryRate),
        temperature: Number(vitals.temperature),
        oxygenSaturation: Number(vitals.oxygenSaturation),
        weight: Number(vitals.weight),
        height: vitals.height ? Number(vitals.height) : undefined,
        painScore: vitals.painScore !== "" ? Number(vitals.painScore) : undefined,
        tempUnit: vitals.tempUnit === "°F" ? "F" : vitals.tempUnit === "°C" ? "C" : vitals.tempUnit,
      };

      // Store vitals data to backend
      await storeVitals(patientId, visitId, sendVitals);

      // Redirect to Intake Complete page (force completion view)
      navigate(`/intake/${patientId}?done=1`);
    } catch (err: any) {
      setError(err.message || "Failed to save vitals");
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    navigate(`/intake/${patientId}?done=1`);
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Objective Vitals Form</h1>
        <p className="text-sm text-gray-600 mt-2">
          Patient: {patientId} • Visit: {visitId}
        </p>
        {alreadySubmitted && (
          <p className="mt-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded px-3 py-2 inline-block">
            Vitals already submitted for this visit. You can review them below.
          </p>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Blood Pressure Section */}
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Blood Pressure</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Systolic (mmHg) *
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
                Diastolic (mmHg) *
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
                Arm Used
              </label>
              <select
                value={vitals.bpArm}
                onChange={(e) => handleInputChange("bpArm", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select arm</option>
                <option value="Left">Left</option>
                <option value="Right">Right</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Position
              </label>
              <select
                value={vitals.bpPosition}
                onChange={(e) => handleInputChange("bpPosition", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select position</option>
                <option value="Sitting">Sitting</option>
                <option value="Standing">Standing</option>
                <option value="Lying">Lying</option>
              </select>
            </div>
          </div>
        </div>

        {/* Heart Rate Section */}
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Heart Rate (Pulse)</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Beats per minute (bpm) *
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
                Rhythm
              </label>
              <select
                value={vitals.rhythm}
                onChange={(e) => handleInputChange("rhythm", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select rhythm</option>
                <option value="Regular">Regular</option>
                <option value="Irregular">Irregular</option>
              </select>
            </div>
          </div>
        </div>

        {/* Respiratory Rate Section */}
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Respiratory Rate</h2>
          <div className="w-full md:w-1/2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Breaths per minute *
            </label>
            <input
              type="number"
              value={vitals.respiratoryRate}
              onChange={(e) => handleInputChange("respiratoryRate", e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="16"
              required
            />
          </div>
        </div>

        {/* Temperature Section */}
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Temperature</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Value *
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
                Unit *
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
                Method
              </label>
              <select
                value={vitals.tempMethod}
                onChange={(e) => handleInputChange("tempMethod", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select method</option>
                <option value="Oral">Oral</option>
                <option value="Axillary">Axillary</option>
                <option value="Tympanic">Tympanic</option>
                <option value="Rectal">Rectal</option>
              </select>
            </div>
          </div>
        </div>

        {/* Oxygen Saturation Section */}
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Oxygen Saturation (SpO₂)</h2>
          <div className="w-full md:w-1/2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              % value *
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
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Height & Weight</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Height (optional)
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
                Weight *
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
                Calculated BMI: <strong>{bmi}</strong>
              </span>
            </div>
          )}
        </div>

        {/* Pain Score Section */}
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Pain Score (Optional)</h2>
          <div className="w-full md:w-1/2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Numeric scale (0-10)
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
              0 = No pain, 10 = Worst possible pain
            </p>
          </div>
        </div>

        {/* Additional Notes */}
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Additional Notes</h2>
          <textarea
            value={vitals.notes}
            onChange={(e) => handleInputChange("notes", e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={4}
            placeholder="Any additional observations or notes..."
          />
        </div>

        {/* Preview */}
        <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Vitals Preview (for SOAP Note)</h2>
          <div className="text-sm text-gray-700 bg-white p-4 rounded border">
            {formatVitalsForSOAP() || "Fill in the required fields to see preview..."}
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
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading || alreadySubmitted}
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {alreadySubmitted ? "Already Submitted" : (loading ? "Saving..." : "Save Vitals")}
          </button>
        </div>
      </form>
    </div>
  );
};

export default VitalsForm;
