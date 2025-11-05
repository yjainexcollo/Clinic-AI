import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { BACKEND_BASE_URL } from "../services/patientService";
import { workflowService } from "../services/workflowService";

const WalkInSoap: React.FC = () => {
  const { patientId = "", visitId = "" } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [soapData, setSoapData] = useState<any>(null);
  const [workflowInfo, setWorkflowInfo] = useState<any>(null);

  // Fetch SOAP data and workflow information
  useEffect(() => {
    const fetchData = async () => {
      if (!patientId || !visitId) return;
      
      setLoading(true);
      try {
        // Fetch SOAP data
        const soapResponse = await fetch(`${BACKEND_BASE_URL}/notes/${encodeURIComponent(patientId)}/visits/${encodeURIComponent(visitId)}/soap`, {
          headers: { Accept: "application/json" },
        });

        if (soapResponse.ok) {
          const response = await soapResponse.json();
          // Extract data from ApiResponse wrapper (backend returns {success, data, message})
          const soap = response.data || response.soap_note || response;
          setSoapData(soap);
        } else if (soapResponse.status === 404) {
          // SOAP not generated yet, that's okay
          setSoapData(null);
        } else {
          throw new Error(`Failed to fetch SOAP: ${soapResponse.status}`);
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

  const generateSoap = async () => {
    setLoading(true);
    setError("");
    
    try {
      const response = await fetch(`${BACKEND_BASE_URL}/notes/soap/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          patient_id: patientId,
          visit_id: visitId
        })
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Failed to generate SOAP: ${response.status} - ${errorData}`);
      }

      // After generating, fetch the SOAP data
      const soapResponse = await fetch(`${BACKEND_BASE_URL}/notes/${encodeURIComponent(patientId)}/visits/${encodeURIComponent(visitId)}/soap`, {
        headers: { Accept: "application/json" },
      });

      if (soapResponse.ok) {
        const response = await soapResponse.json();
        // Extract data from ApiResponse wrapper (backend returns {success, data, message})
        const soap = response.data || response.soap_note || response;
        setSoapData(soap);
      }

      // Refresh workflow steps after generating SOAP
      try {
        const stepsResponse = await workflowService.getAvailableSteps(visitId);
        setWorkflowInfo(stepsResponse);
      } catch (error) {
        console.error("Error refreshing workflow steps:", error);
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate SOAP");
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    // Navigate back to the main workflow page (intake page with all buttons)
    navigate(`/intake/${encodeURIComponent(patientId)}?v=${encodeURIComponent(visitId)}&walkin=true`);
  };



  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Walk-in SOAP Summary</h1>
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
            className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
          >
            Back
          </button>
        </div>
      </div>

      {/* Workflow Status */}
      {workflowInfo && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
          <h3 className="text-sm font-medium text-green-800 mb-2">Current Workflow Status</h3>
          <p className="text-sm text-green-700">
            <strong>Current Step:</strong> SOAP Generation
          </p>
          <p className="text-sm text-green-700">
            <strong>Next Step:</strong> Post-Visit Summary
          </p>
        </div>
      )}


      {/* Error Message */}
      {error && (
        <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* SOAP Content */}
      <div className="bg-white rounded-lg border border-gray-200">
        {!soapData ? (
          <div className="p-8 text-center">
            <div className="mb-4">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">SOAP Note Not Generated</h3>
              <p className="text-gray-600 mb-6">
                Generate a SOAP note based on the patient's transcription and vitals data.
              </p>
              <button
                onClick={generateSoap}
                disabled={loading}
                className="px-6 py-3 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Generating..." : "Generate SOAP Note"}
              </button>
            </div>
          </div>
        ) : (
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">SOAP Note</h2>
            </div>

            {/* SOAP Sections */}
            <div className="space-y-6">
              {/* Subjective */}
              <div className="border-l-4 border-blue-500 pl-4">
                <h3 className="text-lg font-medium text-gray-900 mb-2">Subjective</h3>
                <div className="prose max-w-none">
                  <p className="text-gray-700 whitespace-pre-wrap">{soapData.subjective || "No subjective information available."}</p>
                </div>
              </div>

              {/* Objective */}
              <div className="border-l-4 border-green-500 pl-4">
                <h3 className="text-lg font-medium text-gray-900 mb-2">Objective</h3>
                <div className="prose max-w-none">
                  {soapData.objective ? (
                    <div className="text-gray-700">
                      {typeof soapData.objective === 'string' ? (
                        <p className="whitespace-pre-wrap">{soapData.objective}</p>
                      ) : (
                        <div>
                          {soapData.objective.vital_signs && (
                            <div className="mb-4">
                              <h4 className="font-medium text-gray-900 mb-2">Vital Signs:</h4>
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                {Object.entries(soapData.objective.vital_signs).map(([key, value]) => (
                                  <div key={key} className="bg-gray-50 p-2 rounded">
                                    <span className="font-medium capitalize">{key.replace(/_/g, ' ')}:</span> {String(value)}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          {soapData.objective.physical_exam && (
                            <div>
                              <h4 className="font-medium text-gray-900 mb-2">Physical Examination:</h4>
                              <p className="whitespace-pre-wrap">{JSON.stringify(soapData.objective.physical_exam, null, 2)}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-gray-700">No objective information available.</p>
                  )}
                </div>
              </div>

              {/* Assessment */}
              <div className="border-l-4 border-yellow-500 pl-4">
                <h3 className="text-lg font-medium text-gray-900 mb-2">Assessment</h3>
                <div className="prose max-w-none">
                  <p className="text-gray-700 whitespace-pre-wrap">{soapData.assessment || "No assessment available."}</p>
                </div>
              </div>

              {/* Plan */}
              <div className="border-l-4 border-red-500 pl-4">
                <h3 className="text-lg font-medium text-gray-900 mb-2">Plan</h3>
                <div className="prose max-w-none">
                  <p className="text-gray-700 whitespace-pre-wrap">{soapData.plan || "No plan available."}</p>
                </div>
              </div>

              {/* Highlights and Red Flags */}
              {(soapData.highlights || soapData.red_flags) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {soapData.highlights && soapData.highlights.length > 0 && (
                    <div className="bg-blue-50 p-4 rounded-lg">
                      <h4 className="font-medium text-blue-900 mb-2">Key Highlights</h4>
                      <ul className="text-sm text-blue-800 space-y-1">
                        {soapData.highlights.map((highlight: string, index: number) => (
                          <li key={index} className="flex items-start">
                            <span className="text-blue-500 mr-2">•</span>
                            {highlight}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {soapData.red_flags && soapData.red_flags.length > 0 && (
                    <div className="bg-red-50 p-4 rounded-lg">
                      <h4 className="font-medium text-red-900 mb-2">Red Flags</h4>
                      <ul className="text-sm text-red-800 space-y-1">
                        {soapData.red_flags.map((flag: string, index: number) => (
                          <li key={index} className="flex items-start">
                            <span className="text-red-500 mr-2">⚠</span>
                            {flag}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* Model Information */}
              {soapData.model_info && (
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-medium text-gray-900 mb-2">Generation Details</h4>
                  <div className="text-sm text-gray-600">
                    <p><strong>Model:</strong> {soapData.model_info.model || "Unknown"}</p>
                    <p><strong>Generated:</strong> {new Date(soapData.generated_at).toLocaleString()}</p>
                    {soapData.confidence_score && (
                      <p><strong>Confidence:</strong> {(soapData.confidence_score * 100).toFixed(1)}%</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Workflow Information */}
      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h3 className="text-sm font-medium text-blue-800 mb-2">Walk-in Workflow Information</h3>
        <p className="text-sm text-blue-700">
          The SOAP note is generated based on the patient's transcription and vitals data. 
          After reviewing the SOAP note, you'll proceed to create the post-visit summary for the patient.
        </p>
      </div>
    </div>
  );
};

export default WalkInSoap;
