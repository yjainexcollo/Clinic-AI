import React, { useState, useEffect } from 'react';
import { X, FileText, Clock, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { parseApiResponse, isErrorResponse } from '../utils/apiResponse';
import { BACKEND_BASE_URL, authorizedFetch } from '../services/patientService';

interface ActionPlan {
  action: string[];
  plan: {
    immediate_care: string;
    medications: Array<{
      name: string;
      dosage: string;
      duration: string;
      notes?: string;
    }>;
    follow_up: {
      timeline: string;
      monitoring: string;
      next_steps: string;
    };
    patient_education: string;
    lifestyle_modifications: string;
  };
  confidence: number;
  reasoning: string;
}

interface ActionPlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  adhocId: string;
}

// Use the same BACKEND_BASE_URL as other services to ensure consistency
const API_BASE_URL = BACKEND_BASE_URL;

// Debug: Log the API base URL
console.log('ActionPlanModal API_BASE_URL:', API_BASE_URL);

const ActionPlanModal: React.FC<ActionPlanModalProps> = ({ isOpen, onClose, adhocId }) => {
  const [actionPlan, setActionPlan] = useState<ActionPlan | null>(null);
  const [status, setStatus] = useState<'pending' | 'processing' | 'completed' | 'failed'>('pending');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>('');

  useEffect(() => {
    if (isOpen && adhocId) {
      checkActionPlanStatus();
    }
  }, [isOpen, adhocId]);

  const checkActionPlanStatus = async () => {
    try {
      const url = `${API_BASE_URL}/transcription/adhoc/${adhocId}/action-plan/status`;
      console.log('ActionPlanModal fetching from URL:', url);
      const response = await authorizedFetch(url);
      
      const responseData = await response.json();
      
      if (response.ok && !isErrorResponse(responseData)) {
        // Extract data from ApiResponse wrapper
        const data = responseData.data || responseData;
        setStatus(data.status);
        
        if (data.status === 'completed' && data.has_action_plan) {
          fetchActionPlan();
        } else if (data.status === 'processing') {
          setStatusMessage('Generating Action and Plan...');
          // Start polling
          pollForCompletion();
        } else if (data.status === 'failed') {
          setError(data.error_message || 'Action plan generation failed');
        }
      } else {
        const error = isErrorResponse(responseData)
          ? responseData.message
          : 'Failed to check action plan status';
        setError(error);
      }
    } catch (err) {
      console.error('Error checking action plan status:', err);
      setError(err instanceof Error ? err.message : 'Failed to check action plan status');
    }
  };

  const pollForCompletion = () => {
    const poll = async () => {
      try {
        const response = await authorizedFetch(`${API_BASE_URL}/transcription/adhoc/${adhocId}/action-plan/status`);
        const responseData = await response.json();
        
        if (response.ok && !isErrorResponse(responseData)) {
          // Extract data from ApiResponse wrapper
          const data = responseData.data || responseData;
          setStatus(data.status);
          
          if (data.status === 'completed' && data.has_action_plan) {
            fetchActionPlan();
          } else if (data.status === 'failed') {
            setError(data.error_message || 'Action plan generation failed');
          } else if (data.status === 'processing') {
            // Continue polling
            setTimeout(poll, 2000);
          }
        } else {
          const error = isErrorResponse(responseData)
            ? responseData.message
            : 'Failed to check action plan status';
          setError(error);
        }
      } catch (err) {
        console.error('Error polling action plan status:', err);
        setError(err instanceof Error ? err.message : 'Failed to check action plan status');
      }
    };
    
    setTimeout(poll, 2000);
  };

  const fetchActionPlan = async () => {
    try {
      const response = await authorizedFetch(`${API_BASE_URL}/transcription/adhoc/${adhocId}/action-plan`);
      const responseData = await response.json();
      
      if (response.ok && !isErrorResponse(responseData)) {
        // Extract data from ApiResponse wrapper
        const data = responseData.data || responseData;
        setActionPlan(data.action_plan);
        setStatus('completed');
        setStatusMessage('Action and Plan generated successfully!');
      } else if (response.status === 202) {
        // Still processing
        setStatus('processing');
        setStatusMessage('Generating Action and Plan...');
        setTimeout(pollForCompletion, 2000);
      } else {
        const error = isErrorResponse(responseData)
          ? responseData.message
          : responseData.message || 'Failed to fetch action plan';
        setError(error);
      }
    } catch (err) {
      console.error('Error fetching action plan:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch action plan');
    }
  };

  const generateActionPlan = async () => {
    setIsGenerating(true);
    setError(null);
    setStatusMessage('Starting Action and Plan generation...');
    
    try {
      const url = `${API_BASE_URL}/transcription/adhoc/action-plan`;
      console.log('ActionPlanModal generating from URL:', url);
      const response = await authorizedFetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ adhoc_id: adhocId }),
      });

      const responseData = await response.json();

      if (response.ok && !isErrorResponse(responseData)) {
        // Extract data from ApiResponse wrapper
        const data = responseData.data || responseData;
        setStatus(data.status);
        setStatusMessage(data.message || responseData.message);
        
        if (data.status === 'processing') {
          // Start polling
          pollForCompletion();
        }
      } else {
        const error = isErrorResponse(responseData)
          ? responseData.message
          : responseData.message || 'Failed to start action plan generation';
        setError(error);
      }
    } catch (err) {
      console.error('Error generating action plan:', err);
      setError(err instanceof Error ? err.message : 'Failed to start action plan generation');
    } finally {
      setIsGenerating(false);
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'processing':
        return <Loader2 className="w-5 h-5 animate-spin text-blue-500" />;
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'failed':
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      default:
        return <Clock className="w-5 h-5 text-gray-500" />;
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'processing':
        return 'text-blue-600';
      case 'completed':
        return 'text-green-600';
      case 'failed':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <FileText className="w-6 h-6 text-blue-600" />
            <h2 className="text-xl font-semibold text-gray-900">Action & Plan</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center space-x-2">
                <AlertCircle className="w-5 h-5 text-red-500" />
                <p className="text-red-700">{error}</p>
              </div>
            </div>
          )}

          {status === 'pending' && (
            <div className="text-center py-12">
              <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Generate Action & Plan</h3>
              <p className="text-gray-600 mb-6">
                Generate actionable recommendations and treatment plan from the transcript.
              </p>
              <button
                onClick={generateActionPlan}
                disabled={isGenerating}
                className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
                    Starting Generation...
                  </>
                ) : (
                  'Generate Action & Plan'
                )}
              </button>
            </div>
          )}

          {(status === 'processing' || isGenerating) && (
            <div className="text-center py-12">
              <Loader2 className="w-16 h-16 text-blue-500 animate-spin mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Generating Action & Plan</h3>
              <p className="text-gray-600 mb-4">{statusMessage}</p>
              <div className="flex items-center justify-center space-x-2 text-blue-600">
                {getStatusIcon()}
                <span className="text-sm">This may take a few minutes...</span>
              </div>
            </div>
          )}

          {status === 'completed' && actionPlan && (
            <div className="space-y-6">
              {/* Status */}
              <div className="flex items-center space-x-2 text-green-600">
                {getStatusIcon()}
                <span className="font-medium">Action & Plan Generated Successfully</span>
              </div>

              {/* Actions */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-blue-900 mb-3">Immediate Actions</h3>
                <ul className="space-y-2">
                  {actionPlan.action.map((action, index) => (
                    <li key={index} className="flex items-start space-x-2">
                      <span className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></span>
                      <span className="text-blue-800">{action}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Treatment Plan */}
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-green-900 mb-3">Treatment Plan</h3>
                
                {/* Immediate Care */}
                <div className="mb-4">
                  <h4 className="font-medium text-green-800 mb-2">Immediate Care</h4>
                  <p className="text-green-700">{actionPlan.plan.immediate_care}</p>
                </div>

                {/* Medications */}
                {actionPlan.plan.medications && actionPlan.plan.medications.length > 0 && (
                  <div className="mb-4">
                    <h4 className="font-medium text-green-800 mb-2">Medications</h4>
                    <div className="space-y-3">
                      {actionPlan.plan.medications.map((med, index) => (
                        <div key={index} className="bg-white border border-green-200 rounded p-3">
                          <div className="font-medium text-green-900">{med.name}</div>
                          <div className="text-sm text-green-700">
                            <div>Dosage: {med.dosage}</div>
                            <div>Duration: {med.duration}</div>
                            {med.notes && <div>Notes: {med.notes}</div>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Follow-up */}
                <div className="mb-4">
                  <h4 className="font-medium text-green-800 mb-2">Follow-up</h4>
                  <div className="bg-white border border-green-200 rounded p-3">
                    <div className="text-sm text-green-700 space-y-1">
                      <div><strong>Timeline:</strong> {actionPlan.plan.follow_up.timeline}</div>
                      <div><strong>Monitoring:</strong> {actionPlan.plan.follow_up.monitoring}</div>
                      <div><strong>Next Steps:</strong> {actionPlan.plan.follow_up.next_steps}</div>
                    </div>
                  </div>
                </div>

                {/* Patient Education */}
                <div className="mb-4">
                  <h4 className="font-medium text-green-800 mb-2">Patient Education</h4>
                  <p className="text-green-700 bg-white border border-green-200 rounded p-3">
                    {actionPlan.plan.patient_education}
                  </p>
                </div>

                {/* Lifestyle Modifications */}
                <div>
                  <h4 className="font-medium text-green-800 mb-2">Lifestyle Modifications</h4>
                  <p className="text-green-700 bg-white border border-green-200 rounded p-3">
                    {actionPlan.plan.lifestyle_modifications}
                  </p>
                </div>
              </div>

              {/* Reasoning */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <div>
                  <h4 className="font-medium text-gray-800 mb-2">Reasoning</h4>
                  <p className="text-gray-700 text-sm">{actionPlan.reasoning}</p>
                </div>
              </div>
            </div>
          )}

          {status === 'failed' && (
            <div className="text-center py-12">
              <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Generation Failed</h3>
              <p className="text-gray-600 mb-6">
                {error || 'Failed to generate Action and Plan. Please try again.'}
              </p>
              <button
                onClick={generateActionPlan}
                className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Try Again
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ActionPlanModal;
