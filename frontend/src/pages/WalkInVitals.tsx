import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { BACKEND_BASE_URL, authorizedFetch } from "../services/patientService";
import { workflowService } from "../services/workflowService";

const WalkInVitals: React.FC = () => {
  const { patientId = "", visitId = "" } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [workflowInfo, setWorkflowInfo] = useState<any>(null);
  const [showPostVisitPopup, setShowPostVisitPopup] = useState(false);
  const [generatingPostVisit, setGeneratingPostVisit] = useState(false);

  const [vitals, setVitals] = useState({
    bloodPressure: "",
    heartRate: "",
    temperature: "",
    respiratoryRate: "",
    oxygenSaturation: "",
    weight: "",
    height: "",
    bmi: "",
    notes: ""
  });

  // Fetch workflow information
  useEffect(() => {
    const fetchWorkflowInfo = async () => {
      if (!visitId) return;
      
      try {
        const stepsResponse = await workflowService.getAvailableSteps(visitId);
        setWorkflowInfo(stepsResponse);
      } catch (error) {
        console.error("Error fetching workflow info:", error);
        setError("Failed to load workflow information");
      }
    };

    fetchWorkflowInfo();
  }, [visitId]);

  const handleInputChange = (field: string, value: string) => {
    setVitals(prev => ({
      ...prev,
      [field]: value
    }));

    // Auto-calculate BMI if weight and height are provided
    if (field === "weight" || field === "height") {
      const weight = field === "weight" ? parseFloat(value) : parseFloat(vitals.weight);
      const height = field === "height" ? parseFloat(value) : parseFloat(vitals.height);
      
      if (weight && height && height > 0) {
        const bmi = (weight / ((height / 100) ** 2)).toFixed(1);
        setVitals(prev => ({
          ...prev,
          bmi: bmi
        }));
      }
    }
  };

  const validateForm = (): boolean => {
    if (!vitals.bloodPressure.trim()) {
      setError("Blood pressure is required");
      return false;
    }
    if (!vitals.heartRate.trim()) {
      setError("Heart rate is required");
      return false;
    }
    if (!vitals.temperature.trim()) {
      setError("Temperature is required");
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    setLoading(true);
    setError("");
    
    try {
      // Convert vitals to the format expected by the backend
      const vitalsPayload = {
        bloodPressure: vitals.bloodPressure,
        heartRate: vitals.heartRate,
        temperature: vitals.temperature,
        respiratoryRate: vitals.respiratoryRate,
        oxygenSaturation: vitals.oxygenSaturation,
        weight: vitals.weight,
        height: vitals.height,
        bmi: vitals.bmi,
        notes: vitals.notes
      };

      const response = await authorizedFetch(`${BACKEND_BASE_URL}/patients/${encodeURIComponent(patientId)}/visits/${encodeURIComponent(visitId)}/vitals`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(vitalsPayload),
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Failed to save vitals: ${response.status} - ${errorData}`);
      }

      setSuccess(true);
      
      // Refresh workflow steps after saving vitals
      try {
        const stepsResponse = await workflowService.getAvailableSteps(visitId);
        setWorkflowInfo(stepsResponse);
      } catch (error) {
        console.error("Error refreshing workflow steps:", error);
      }

      // Redirect to main buttons page after successful vitals submission
      // Wait a moment to show success message, then redirect
      setTimeout(() => {
        navigate(`/intake/${encodeURIComponent(patientId)}?v=${encodeURIComponent(visitId)}&walkin=true`);
      }, 1500);

    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save vitals");
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    // Navigate back to intake page (which has transcription functionality)
    navigate(`/intake/${encodeURIComponent(patientId)}?v=${encodeURIComponent(visitId)}&walkin=true`);
  };

  const handleGeneratePostVisitSummary = async () => {
    setGeneratingPostVisit(true);
    try {
      const response = await authorizedFetch(`${BACKEND_BASE_URL}/patients/summary/postvisit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patient_id: patientId,
          visit_id: visitId
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to generate post-visit summary: ${response.status}`);
      }

      // Show success popup
      setShowPostVisitPopup(true);
      
      // Refresh workflow steps
      try {
        const stepsResponse = await workflowService.getAvailableSteps(visitId);
        setWorkflowInfo(stepsResponse);
      } catch (error) {
        console.error("Error refreshing workflow steps:", error);
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate post-visit summary");
    } finally {
      setGeneratingPostVisit(false);
    }
  };

  const handleViewPostVisitSummary = () => {
    navigate(`/walk-in-post-visit/${encodeURIComponent(patientId)}/${encodeURIComponent(visitId)}`);
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Walk-in Vitals Form</h1>
          <p className="text-sm text-gray-600 mt-1">
            Patient: {patientId} • Visit: {visitId}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            Walk-in Workflow
          </span>
          <button
            onClick={handleBack}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
          >
            Back to Transcription
          </button>
        </div>
      </div>

      {/* Workflow Status */}
      {workflowInfo && (
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

      <div className="bg-white p-6 rounded-lg border border-gray-200">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Vital Signs Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Blood Pressure */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Blood Pressure (mmHg) *
              </label>
              <input
                type="text"
                value={vitals.bloodPressure}
                onChange={(e) => handleInputChange("bloodPressure", e.target.value)}
                placeholder="e.g., 120/80"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            {/* Heart Rate */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Heart Rate (BPM) *
              </label>
              <input
                type="number"
                value={vitals.heartRate}
                onChange={(e) => handleInputChange("heartRate", e.target.value)}
                placeholder="e.g., 72"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            {/* Temperature */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Temperature (°F) *
              </label>
              <input
                type="number"
                step="0.1"
                value={vitals.temperature}
                onChange={(e) => handleInputChange("temperature", e.target.value)}
                placeholder="e.g., 98.6"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            {/* Respiratory Rate */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Respiratory Rate (breaths/min)
              </label>
              <input
                type="number"
                value={vitals.respiratoryRate}
                onChange={(e) => handleInputChange("respiratoryRate", e.target.value)}
                placeholder="e.g., 16"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Oxygen Saturation */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Oxygen Saturation (%)
              </label>
              <input
                type="number"
                value={vitals.oxygenSaturation}
                onChange={(e) => handleInputChange("oxygenSaturation", e.target.value)}
                placeholder="e.g., 98"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Weight */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Weight (kg)
              </label>
              <input
                type="number"
                step="0.1"
                value={vitals.weight}
                onChange={(e) => handleInputChange("weight", e.target.value)}
                placeholder="e.g., 70.5"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Height */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Height (cm)
              </label>
              <input
                type="number"
                value={vitals.height}
                onChange={(e) => handleInputChange("height", e.target.value)}
                placeholder="e.g., 175"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* BMI (Auto-calculated) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                BMI (kg/m²)
              </label>
              <input
                type="text"
                value={vitals.bmi}
                readOnly
                placeholder="Auto-calculated"
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-600"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Additional Notes
            </label>
            <textarea
              value={vitals.notes}
              onChange={(e) => handleInputChange("notes", e.target.value)}
              placeholder="Any additional observations or notes..."
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {/* Success Message */}
          {success && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-md">
              <p className="text-sm text-green-800">
                Vitals saved successfully! SOAP summary has been automatically generated.
              </p>
            </div>
          )}

          {/* Submit Button */}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={loading || success}
              className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Saving..." : success ? "Saved!" : "Save Vitals & Continue"}
            </button>
          </div>
        </form>
      </div>

      {/* Action Buttons - Show after vitals are saved */}
      {success && (
        <div className="mt-6 bg-white p-6 rounded-lg border border-gray-200">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Next Steps</h3>
          <div className="flex gap-4">
            <button
              onClick={handleGeneratePostVisitSummary}
              disabled={generatingPostVisit}
              className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {generatingPostVisit ? "Generating..." : "Generate Post Visit Summary"}
            </button>
            
            {workflowInfo?.available_steps?.includes("post_visit_summary") && (
              <button
                onClick={handleViewPostVisitSummary}
                className="px-6 py-3 bg-green-600 text-white rounded-md hover:bg-green-700 font-medium"
              >
                View Post Visit Summary
              </button>
            )}
          </div>
        </div>
      )}

      {/* Workflow Information */}
      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h3 className="text-sm font-medium text-blue-800 mb-2">Walk-in Workflow Information</h3>
        <p className="text-sm text-blue-700">
          After saving vitals, you'll proceed to SOAP generation, followed by the post-visit summary.
          This streamlined process ensures efficient care for walk-in patients.
        </p>
      </div>

      {/* Post Visit Summary Success Popup */}
      {showPostVisitPopup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-6 text-center">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Post Visit Summary Generated Successfully!</h3>
            <p className="text-sm text-gray-600 mb-4">
              The post-visit summary has been created and is ready for review.
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => setShowPostVisitPopup(false)}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              >
                Close
              </button>
              <button
                onClick={() => {
                  setShowPostVisitPopup(false);
                  handleViewPostVisitSummary();
                }}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
              >
                View Summary
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WalkInVitals;
