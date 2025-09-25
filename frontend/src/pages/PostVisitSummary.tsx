import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Alert, AlertDescription } from '../components/ui/alert';
import { 
  Calendar, 
  User, 
  Clock, 
  FileText, 
  Share2, 
  ArrowLeft,
  Loader2,
  AlertCircle,
  CheckCircle2
} from 'lucide-react';
import { getPostVisitSummary, sharePostVisitSummaryViaWhatsApp, PostVisitSummaryResponse } from '../services/patientService';

const PostVisitSummary: React.FC = () => {
  const { patientId, visitId } = useParams<{ patientId: string; visitId: string }>();
  const navigate = useNavigate();
  const [summary, setSummary] = useState<PostVisitSummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');

  const loadPostVisitSummary = async () => {
    if (!patientId || !visitId) {
      setError('Missing patient or visit ID');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError('');
      const data = await getPostVisitSummary(patientId, visitId);
      setSummary(data);
    } catch (err: any) {
      console.error('Error loading post-visit summary:', err);
      if (err.message?.includes('422')) {
        setError('Post-visit summary cannot be generated yet. Please complete the SOAP summary first.');
      } else if (err.message?.includes('404')) {
        setError('Visit or patient not found.');
      } else if (err.message?.includes('400')) {
        setError('Invalid request. Please check your data.');
      } else {
        setError('Failed to load post-visit summary. Please try again later.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPostVisitSummary();
  }, [patientId, visitId]);

  const handleGoBack = () => {
    navigate(`/soap/${patientId}/${visitId}`);
  };

  const handleShareViaWhatsApp = () => {
    if (summary) {
      sharePostVisitSummaryViaWhatsApp(summary);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600">Loading post-visit summary...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md mx-auto p-6">
          <Alert className="border-red-200 bg-red-50">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-800">
              <p className="font-medium mb-2">Error Loading Summary</p>
              <p className="text-sm mb-4">{error}</p>
              <div className="flex gap-2">
                <Button onClick={handleGoBack} variant="outline" size="sm">
                  Go Back
                </Button>
                <Button onClick={loadPostVisitSummary} size="sm">
                  Try Again
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">No Summary Found</h2>
          <p className="text-gray-600 mb-4">Post-visit summary is not available for this visit.</p>
          <Button onClick={handleGoBack}>Go Back</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto p-4">
        {/* Header */}
        <div className="mb-6">
          <Button
            onClick={handleGoBack}
            variant="ghost"
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to SOAP Summary
          </Button>
          
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Post-Visit Summary
              </h1>
              <p className="text-gray-600 mt-2">
                Patient-friendly summary for sharing
              </p>
            </div>
            <div className="flex space-x-2">
              <Button
                onClick={handleShareViaWhatsApp}
                className="bg-green-600 hover:bg-green-700"
              >
                <Share2 className="h-4 w-4 mr-2" />
                Share via WhatsApp
              </Button>
              <Button onClick={() => window.print()} variant="outline">
                <FileText className="h-4 w-4 mr-2" />
                Print
              </Button>
            </div>
          </div>
        </div>

        {/* Patient Info Card */}
        <Card className="mb-6">
          <CardHeader className="bg-gradient-to-r from-green-50 to-blue-50">
            <CardTitle className="text-2xl text-gray-900">{summary.patient_name}</CardTitle>
            <CardDescription className="flex flex-wrap gap-4 text-sm">
              <span className="flex items-center">
                <Calendar className="h-4 w-4 mr-1" />
                Visit Date: {new Date(summary.visit_date).toLocaleDateString()}
              </span>
              <span className="flex items-center">
                <User className="h-4 w-4 mr-1" />
                {summary.doctor_name}
              </span>
              <span className="flex items-center">
                <CheckCircle2 className="h-4 w-4 mr-1" />
                {summary.clinic_name}
              </span>
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Chief Complaint */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Chief Complaint</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-700">{summary.chief_complaint || 'No chief complaint recorded'}</p>
          </CardContent>
        </Card>

        {/* Key Findings */}
        {summary.key_findings.length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg">Key Findings</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {summary.key_findings.map((finding, index) => (
                  <li key={index} className="flex items-start">
                    <span className="text-blue-600 mr-2 mt-1">•</span>
                    <span className="text-gray-700">{finding}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Diagnosis */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Diagnosis</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-700">{summary.diagnosis}</p>
          </CardContent>
        </Card>

        {/* Medications */}
        {summary.medications.length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg">Medications Prescribed</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {summary.medications.map((med, index) => (
                  <div key={index} className="border rounded-lg p-4">
                    <h4 className="font-semibold text-gray-900 mb-2">{med.name}</h4>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div><span className="font-medium">Dosage:</span> {med.dosage}</div>
                      <div><span className="font-medium">Frequency:</span> {med.frequency}</div>
                      <div><span className="font-medium">Duration:</span> {med.duration}</div>
                      {med.purpose && <div><span className="font-medium">Purpose:</span> {med.purpose}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Other Recommendations */}
        {summary.other_recommendations.length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg">Other Recommendations</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {summary.other_recommendations.map((rec, index) => (
                  <li key={index} className="flex items-start">
                    <span className="text-green-600 mr-2 mt-1">•</span>
                    <span className="text-gray-700">{rec}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Tests Ordered */}
        {summary.tests_ordered.length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg">Tests Ordered</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {summary.tests_ordered.map((test, index) => (
                  <div key={index} className="border rounded-lg p-4">
                    <h4 className="font-semibold text-gray-900 mb-2">{test.test_name}</h4>
                    <div className="text-sm space-y-1">
                      <div><span className="font-medium">Purpose:</span> {test.purpose}</div>
                      <div><span className="font-medium">Instructions:</span> {test.instructions}</div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Next Appointment */}
        {summary.next_appointment && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg">Next Appointment</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-700">{summary.next_appointment}</p>
            </CardContent>
          </Card>
        )}

        {/* Warning Signs */}
        {summary.red_flag_symptoms.length > 0 && (
          <Card className="mb-6 border-red-200">
            <CardHeader className="bg-red-50">
              <CardTitle className="text-lg text-red-800 flex items-center">
                <AlertCircle className="h-5 w-5 mr-2" />
                Warning Signs
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Alert className="border-red-200 bg-red-50">
                <AlertCircle className="h-4 w-4 text-red-600" />
                <AlertDescription className="text-red-800">
                  <p className="font-medium mb-2">Seek immediate medical attention if you experience:</p>
                  <ul className="space-y-1">
                    {summary.red_flag_symptoms.map((symptom, index) => (
                      <li key={index} className="flex items-start">
                        <span className="text-red-600 mr-2 mt-1">•</span>
                        <span>{symptom}</span>
                      </li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        )}

        {/* Patient Instructions */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Patient Instructions</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {summary.patient_instructions.map((instruction, index) => (
                <li key={index} className="flex items-start">
                  <span className="text-green-600 mr-2 mt-1">{index + 1}.</span>
                  <span className="text-gray-700">{instruction}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* Closing Note */}
        <Card className="mb-6 border-blue-200">
          <CardHeader className="bg-blue-50">
            <CardTitle className="text-lg text-blue-800">Closing Note</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-blue-800 font-medium mb-2">{summary.reassurance_note}</p>
            <p className="text-blue-700 text-sm">📞 Contact: {summary.clinic_contact}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PostVisitSummary;
