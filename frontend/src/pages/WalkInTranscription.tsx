import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { ArrowLeft, Upload, Mic, FileAudio, CheckCircle, AlertCircle, RefreshCw } from "lucide-react";
import { workflowService } from "../services/workflowService";
import WorkflowStatus from "../components/WorkflowStatus";

const WalkInTranscription: React.FC = () => {
  const { patientId, visitId } = useParams<{ patientId: string; visitId: string }>();
  const navigate = useNavigate();
  
  const [workflowInfo, setWorkflowInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (patientId && visitId) {
      fetchWorkflowInfo();
    }
  }, [patientId, visitId]);

  const fetchWorkflowInfo = async () => {
    try {
      setLoading(true);
      setError("");
      
      // Get available steps to verify the visit
      const steps = await workflowService.getAvailableSteps(visitId!);
      setWorkflowInfo(steps);
      
    } catch (err) {
      console.error("Error fetching workflow info:", err);
      const errorMessage = err instanceof Error ? err.message : "Failed to load visit information";
      setError(errorMessage);
      
      // If it's a 404 error, the visit might not exist
      if (errorMessage.includes("404") || errorMessage.includes("not found")) {
        setError("Visit not found. Please check the patient ID and visit ID.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleStepClick = (step: string) => {
    if (!patientId || !visitId) return;

    switch (step) {
      case "transcription":
        // Navigate to intake page (which has transcription functionality built-in)
        navigate(`/intake/${encodeURIComponent(patientId)}?v=${encodeURIComponent(visitId)}&walkin=true`);
        break;
      case "vitals":
        // Navigate to vitals form page
        navigate(`/vitals/${encodeURIComponent(patientId)}/${encodeURIComponent(visitId)}`);
        break;
      case "soap_generation":
        // Navigate to SOAP generation page
        navigate(`/soap/${encodeURIComponent(patientId)}/${encodeURIComponent(visitId)}`);
        break;
      case "post_visit_summary":
        // Navigate to post-visit summary page
        navigate(`/post-visit/${encodeURIComponent(patientId)}/${encodeURIComponent(visitId)}`);
        break;
      default:
        console.log("Step clicked:", step);
    }
  };

  const handleBack = () => {
    navigate("/workflow-selector");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="p-6">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading walk-in visit...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-6">
            <div className="text-center">
              <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Error Loading Visit</h3>
              <p className="text-gray-600 mb-4">{error}</p>
              <div className="space-x-2">
                <Button onClick={handleBack} variant="outline">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Workflow Selector
                </Button>
                <Button onClick={fetchWorkflowInfo}>
                  Try Again
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <Button onClick={handleBack} variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div className="flex items-center space-x-2">
            <Button onClick={fetchWorkflowInfo} variant="outline" size="sm" disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Badge className="bg-green-100 text-green-800">
              Walk-in Visit
            </Badge>
          </div>
        </div>
          <h1 className="text-3xl font-bold text-gray-900">Walk-in Patient Consultation</h1>
          <p className="text-gray-600 mt-2">
            Patient ID: {patientId} • Visit ID: {visitId}
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Workflow Status */}
          <div>
            <WorkflowStatus
              visitId={visitId!}
              patientId={patientId!}
              workflowType="walk-in"
              onStepClick={handleStepClick}
            />
          </div>

          {/* Quick Actions */}
          <div className="space-y-6">
            {/* Start Transcription */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Mic className="h-5 w-5 mr-2 text-blue-500" />
                  Start Audio Transcription
                </CardTitle>
                <CardDescription>
                  Upload or record the consultation audio to begin transcription
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <Button 
                    onClick={() => handleStepClick("transcription")}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Upload Audio File
                  </Button>
                  <Button 
                    onClick={() => handleStepClick("transcription")}
                    variant="outline"
                    className="w-full"
                  >
                    <Mic className="h-4 w-4 mr-2" />
                    Record Audio
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Workflow Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <CheckCircle className="h-5 w-5 mr-2 text-green-500" />
                  Walk-in Workflow
                </CardTitle>
                <CardDescription>
                  This visit follows the walk-in workflow
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 text-sm">
                  <div className="flex items-center">
                    <div className="w-2 h-2 bg-green-500 rounded-full mr-3"></div>
                    <span className="text-gray-600">Patient registered</span>
                  </div>
                  <div className="flex items-center">
                    <div className="w-2 h-2 bg-gray-300 rounded-full mr-3"></div>
                    <span className="text-gray-400 line-through">Intake form (skipped)</span>
                  </div>
                  <div className="flex items-center">
                    <div className="w-2 h-2 bg-gray-300 rounded-full mr-3"></div>
                    <span className="text-gray-400 line-through">Pre-visit summary (skipped)</span>
                  </div>
                  <div className="flex items-center">
                    <div className="w-2 h-2 bg-blue-500 rounded-full mr-3"></div>
                    <span className="text-gray-600">Audio transcription (next step)</span>
                  </div>
                  <div className="flex items-center">
                    <div className="w-2 h-2 bg-gray-300 rounded-full mr-3"></div>
                    <span className="text-gray-400">Vitals form</span>
                  </div>
                  <div className="flex items-center">
                    <div className="w-2 h-2 bg-gray-300 rounded-full mr-3"></div>
                    <span className="text-gray-400">SOAP generation</span>
                  </div>
                  <div className="flex items-center">
                    <div className="w-2 h-2 bg-gray-300 rounded-full mr-3"></div>
                    <span className="text-gray-400">Post-visit summary</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Help */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Need Help?</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-gray-600">
                  For walk-in patients, follow the sequential workflow: Audio Transcription → Vitals Form → SOAP Generation → Post-Visit Summary. 
                  The intake form and pre-visit summary steps are skipped to save time.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WalkInTranscription;
