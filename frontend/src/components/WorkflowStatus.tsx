import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { CheckCircle, Clock, AlertCircle, Loader2, RefreshCw } from "lucide-react";
import { workflowService, AvailableStepsResponse } from "../services/workflowService";

export interface WorkflowStatusProps {
  visitId: string;
  patientId: string;
  workflowType: "scheduled" | "walk-in";
  onStepClick?: (step: string) => void;
}

const WorkflowStatus: React.FC<WorkflowStatusProps> = ({ 
  visitId, 
  patientId, 
  workflowType, 
  onStepClick 
}) => {
  const [availableSteps, setAvailableSteps] = useState<AvailableStepsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchAvailableSteps = async () => {
    try {
      setLoading(true);
      setError("");
      const steps = await workflowService.getAvailableSteps(visitId);
      setAvailableSteps(steps);
    } catch (err) {
      console.error("Error fetching available steps:", err);
      const errorMessage = err instanceof Error ? err.message : "Failed to load workflow status";
      setError(errorMessage);
      
      // Handle specific error cases
      if (errorMessage.includes("404") || errorMessage.includes("not found")) {
        setError("Visit not found. Please check the visit ID.");
      } else if (errorMessage.includes("Network error")) {
        setError("Network error. Please check your connection and try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAvailableSteps();
  }, [visitId]);

  const getStepIcon = (step: string) => {
    switch (step) {
      case "intake":
        return "📝";
      case "pre_visit_summary":
        return "📋";
      case "transcription":
        return "🎤";
      case "vitals":
        return "🩺";
      case "soap_generation":
        return "📄";
      case "post_visit_summary":
        return "📊";
      default:
        return "⚪";
    }
  };

  const getStepName = (step: string) => {
    switch (step) {
      case "intake":
        return "Intake Form";
      case "pre_visit_summary":
        return "Pre-Visit Summary";
      case "transcription":
        return "Audio Transcription";
      case "vitals":
        return "Vitals Form";
      case "soap_generation":
        return "SOAP Generation";
      case "post_visit_summary":
        return "Post-Visit Summary";
      default:
        return step.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase());
    }
  };

  const getStepDescription = (step: string) => {
    switch (step) {
      case "intake":
        return "Complete the patient intake questionnaire";
      case "pre_visit_summary":
        return "Generate clinical summary from intake data";
      case "transcription":
        return "Upload and transcribe consultation audio";
      case "vitals":
        return "Enter patient vital signs and measurements";
      case "soap_generation":
        return "Generate SOAP note from transcription";
      case "post_visit_summary":
        return "Create final visit summary for patient";
      default:
        return "Complete this step";
    }
  };

  const getWorkflowTypeColor = (type: string) => {
    return type === "scheduled" ? "bg-blue-100 text-blue-800" : "bg-green-100 text-green-800";
  };

  const getWorkflowTypeName = (type: string) => {
    return type === "scheduled" ? "Scheduled Visit" : "Walk-in Visit";
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin mr-2" />
            <span>Loading workflow status...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">
            <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-2" />
            <p className="text-red-600 mb-4">{error}</p>
            <Button onClick={fetchAvailableSteps} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!availableSteps) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">
            <AlertCircle className="h-8 w-8 text-yellow-500 mx-auto mb-2" />
            <p className="text-gray-600">No workflow information available</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">Workflow Status</CardTitle>
            <CardDescription>
              Visit ID: {visitId} • Patient ID: {patientId}
            </CardDescription>
          </div>
          <Badge className={getWorkflowTypeColor(availableSteps.workflow_type)}>
            {getWorkflowTypeName(availableSteps.workflow_type)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Current Status */}
          <div className="flex items-center space-x-2">
            <Clock className="h-4 w-4 text-blue-500" />
            <span className="text-sm font-medium">Current Status:</span>
            <Badge variant="outline">
              {availableSteps.current_status.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}
            </Badge>
          </div>

          {/* Available Steps */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-3">Available Steps:</h4>
            <div className="space-y-2">
              {availableSteps.available_steps.map((step, index) => (
                <div
                  key={step}
                  className={`flex items-center space-x-3 p-3 rounded-lg border ${
                    onStepClick ? "cursor-pointer hover:bg-gray-50" : ""
                  }`}
                  onClick={() => onStepClick?.(step)}
                >
                  <div className="flex-shrink-0">
                    <span className="text-lg">{getStepIcon(step)}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">
                      {getStepName(step)}
                    </p>
                    <p className="text-xs text-gray-500">
                      {getStepDescription(step)}
                    </p>
                  </div>
                  <div className="flex-shrink-0">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Workflow Type Info */}
          <div className="mt-4 p-3 bg-gray-50 rounded-lg">
            <h5 className="text-xs font-medium text-gray-700 mb-1">Workflow Information:</h5>
            <p className="text-xs text-gray-600">
              {workflowType === "scheduled" 
                ? "This is a scheduled visit. The patient will complete the intake form before proceeding to transcription."
                : "This is a walk-in visit. The patient will skip the intake form and proceed directly to transcription."
              }
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default WorkflowStatus;
