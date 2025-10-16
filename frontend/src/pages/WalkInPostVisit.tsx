import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { BACKEND_BASE_URL } from "../services/patientService";
import { workflowService } from "../services/workflowService";

const WalkInPostVisit: React.FC = () => {
  const { patientId = "", visitId = "" } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [summaryData, setSummaryData] = useState<any>(null);
  const [workflowInfo, setWorkflowInfo] = useState<any>(null);

  // Fetch post-visit summary and workflow information
  useEffect(() => {
    const fetchData = async () => {
      if (!patientId || !visitId) return;
      
      setLoading(true);
      try {
        // Fetch post-visit summary
        const summaryResponse = await fetch(`${BACKEND_BASE_URL}/patients/${encodeURIComponent(patientId)}/visits/${encodeURIComponent(visitId)}/post-visit-summary`, {
          headers: { Accept: "application/json" },
        });

        if (summaryResponse.ok) {
          const summary = await summaryResponse.json();
          setSummaryData(summary);
        } else if (summaryResponse.status === 404) {
          // Summary not generated yet, that's okay
          setSummaryData(null);
        } else {
          throw new Error(`Failed to fetch post-visit summary: ${summaryResponse.status}`);
        }

        // Fetch workflow information
        const stepsResponse = await workflowService.getAvailableSteps(visitId);
        setWorkflowInfo(stepsResponse);

      } catch (err) {
        console.error("Error fetching data:", err);
        setError(err instanceof Error ? err.message : "Failed to load data");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [patientId, visitId]);

  const generateSummary = async () => {
    setLoading(true);
    setError("");
    
    try {
      const response = await fetch(`${BACKEND_BASE_URL}/patients/${encodeURIComponent(patientId)}/visits/${encodeURIComponent(visitId)}/post-visit-summary`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Failed to generate post-visit summary: ${response.status} - ${errorData}`);
      }

      const summary = await response.json();
      setSummaryData(summary);

      // Refresh workflow steps after generating summary
      try {
        const stepsResponse = await workflowService.getAvailableSteps(visitId);
        setWorkflowInfo(stepsResponse);
      } catch (error) {
        console.error("Error refreshing workflow steps:", error);
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate post-visit summary");
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    navigate(`/walk-in-soap/${encodeURIComponent(patientId)}/${encodeURIComponent(visitId)}`);
  };

  const handleComplete = () => {
    // Navigate back to workflow selector or show completion message
    navigate("/workflow-selector");
  };

  const handleViewTranscript = () => {
    navigate(`/transcript-view/${encodeURIComponent(patientId)}/${encodeURIComponent(visitId)}`);
  };

  const handleViewVitals = () => {
    navigate(`/vitals/${encodeURIComponent(patientId)}/${encodeURIComponent(visitId)}`);
  };

  const handleViewSoap = () => {
    navigate(`/walk-in-soap/${encodeURIComponent(patientId)}/${encodeURIComponent(visitId)}`);
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Walk-in Post-Visit Summary</h1>
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
            Back to SOAP
          </button>
        </div>
      </div>

      {/* Workflow Status */}
      {workflowInfo && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
          <h3 className="text-sm font-medium text-green-800 mb-2">Current Workflow Status</h3>
          <p className="text-sm text-green-700">
            <strong>Current Step:</strong> Post-Visit Summary
          </p>
          <p className="text-sm text-green-700">
            <strong>Status:</strong> Final step - Ready to complete visit
          </p>
        </div>
      )}

      {/* Quick Navigation */}
      <div className="mb-6 flex gap-3 flex-wrap">
        <button
          onClick={handleViewTranscript}
          className="px-4 py-2 bg-blue-100 text-blue-800 rounded-md hover:bg-blue-200 text-sm"
        >
          View Transcript
        </button>
        <button
          onClick={handleViewVitals}
          className="px-4 py-2 bg-gray-100 text-gray-800 rounded-md hover:bg-gray-200 text-sm"
        >
          View Vitals
        </button>
        <button
          onClick={handleViewSoap}
          className="px-4 py-2 bg-purple-100 text-purple-800 rounded-md hover:bg-purple-200 text-sm"
        >
          View SOAP Note
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* Summary Content */}
      <div className="bg-white rounded-lg border border-gray-200">
        {!summaryData ? (
          <div className="p-8 text-center">
            <div className="mb-4">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Post-Visit Summary Not Generated</h3>
              <p className="text-gray-600 mb-6">
                Generate a patient-friendly summary based on the consultation, vitals, and SOAP note.
              </p>
              <button
                onClick={generateSummary}
                disabled={loading}
                className="px-6 py-3 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Generating..." : "Generate Post-Visit Summary"}
              </button>
            </div>
          </div>
        ) : (
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">Post-Visit Summary</h2>
              <div className="flex gap-2">
                <button
                  onClick={generateSummary}
                  disabled={loading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 text-sm"
                >
                  {loading ? "Regenerating..." : "Regenerate"}
                </button>
                <button
                  onClick={handleComplete}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm"
                >
                  Complete Visit
                </button>
              </div>
            </div>

            {/* Summary Sections */}
            <div className="space-y-6">
              {/* Visit Overview */}
              <div className="bg-blue-50 p-4 rounded-lg">
                <h3 className="text-lg font-medium text-blue-900 mb-2">Visit Overview</h3>
                <div className="text-blue-800">
                  <p><strong>Date:</strong> {new Date().toLocaleDateString()}</p>
                  <p><strong>Patient:</strong> {patientId}</p>
                  <p><strong>Visit Type:</strong> Walk-in Consultation</p>
                </div>
              </div>

              {/* Chief Complaint */}
              {summaryData.chief_complaint && (
                <div className="border-l-4 border-red-500 pl-4">
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Chief Complaint</h3>
                  <p className="text-gray-700">{summaryData.chief_complaint}</p>
                </div>
              )}

              {/* Assessment */}
              {summaryData.assessment && (
                <div className="border-l-4 border-yellow-500 pl-4">
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Assessment</h3>
                  <div className="prose max-w-none">
                    <p className="text-gray-700 whitespace-pre-wrap">{summaryData.assessment}</p>
                  </div>
                </div>
              )}

              {/* Treatment Plan */}
              {summaryData.treatment_plan && (
                <div className="border-l-4 border-green-500 pl-4">
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Treatment Plan</h3>
                  <div className="prose max-w-none">
                    <p className="text-gray-700 whitespace-pre-wrap">{summaryData.treatment_plan}</p>
                  </div>
                </div>
              )}

              {/* Medications */}
              {summaryData.medications && summaryData.medications.length > 0 && (
                <div className="border-l-4 border-purple-500 pl-4">
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Medications</h3>
                  <div className="space-y-2">
                    {summaryData.medications.map((med: any, index: number) => (
                      <div key={index} className="bg-gray-50 p-3 rounded">
                        <p className="font-medium">{med.name}</p>
                        {med.dosage && <p className="text-sm text-gray-600">Dosage: {med.dosage}</p>}
                        {med.instructions && <p className="text-sm text-gray-600">Instructions: {med.instructions}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Follow-up Instructions */}
              {summaryData.follow_up && (
                <div className="border-l-4 border-blue-500 pl-4">
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Follow-up Instructions</h3>
                  <div className="prose max-w-none">
                    <p className="text-gray-700 whitespace-pre-wrap">{summaryData.follow_up}</p>
                  </div>
                </div>
              )}

              {/* Important Notes */}
              {summaryData.important_notes && (
                <div className="bg-yellow-50 p-4 rounded-lg">
                  <h3 className="text-lg font-medium text-yellow-900 mb-2">Important Notes</h3>
                  <div className="prose max-w-none">
                    <p className="text-yellow-800 whitespace-pre-wrap">{summaryData.important_notes}</p>
                  </div>
                </div>
              )}

              {/* Emergency Instructions */}
              {summaryData.emergency_instructions && (
                <div className="bg-red-50 p-4 rounded-lg">
                  <h3 className="text-lg font-medium text-red-900 mb-2">Emergency Instructions</h3>
                  <div className="prose max-w-none">
                    <p className="text-red-800 whitespace-pre-wrap">{summaryData.emergency_instructions}</p>
                  </div>
                </div>
              )}

              {/* Contact Information */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="text-lg font-medium text-gray-900 mb-2">Contact Information</h3>
                <div className="text-gray-700">
                  <p>If you have any questions or concerns, please contact our clinic:</p>
                  <p className="mt-2"><strong>Phone:</strong> [Clinic Phone Number]</p>
                  <p><strong>Hours:</strong> [Clinic Hours]</p>
                  <p><strong>Emergency:</strong> Call 911 for medical emergencies</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Workflow Information */}
      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h3 className="text-sm font-medium text-blue-800 mb-2">Walk-in Workflow Complete</h3>
        <p className="text-sm text-blue-700">
          This is the final step of the walk-in workflow. The post-visit summary provides a patient-friendly 
          overview of their consultation, treatment plan, and follow-up instructions.
        </p>
      </div>
    </div>
  );
};

export default WalkInPostVisit;
