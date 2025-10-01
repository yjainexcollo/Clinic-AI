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
import { useLanguage } from '../contexts/LanguageContext';

const PostVisitSummary: React.FC = () => {
  const { patientId, visitId } = useParams<{ patientId: string; visitId: string }>();
  const navigate = useNavigate();
  const { language, setLanguage, t } = useLanguage();
  const [summary, setSummary] = useState<PostVisitSummaryResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [processing, setProcessing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    console.log('PostVisitSummary: patientId from URL:', patientId);
    console.log('PostVisitSummary: visitId from URL:', visitId);
    console.log('PostVisitSummary: URL params received:', { patientId, visitId });
    
    if (patientId && visitId) {
      console.log('PostVisitSummary: Both IDs present, loading summary...');
      loadPostVisitSummary();
    } else {
      console.error('PostVisitSummary: Missing IDs:', { patientId, visitId });
    }
  }, [patientId, visitId]);

  const loadPostVisitSummary = async () => {
    if (!patientId || !visitId) return;
    
    try {
      setLoading(true);
      setError(null);
      
              setProcessing(true);
              const data = await getPostVisitSummary(patientId, visitId);
              setProcessing(false);
              console.log('PostVisitSummary: Received data:', data);
              console.log('PostVisitSummary: Chief complaint:', data.chief_complaint);
              setSummary(data);
    } catch (err) {
      console.error('Error loading post-visit summary:', err);
      
      // Provide more specific error messages based on the error
      let errorMessage = 'Failed to load post-visit summary';
      
      if (err instanceof Error) {
        console.log('Error message:', err.message);
        console.log('Error details:', err);
        
        if (err.message.includes('422')) {
          errorMessage = 'Post-visit summary cannot be generated yet. Please ensure SOAP notes are generated first.';
        } else if (err.message.includes('404')) {
          errorMessage = 'Patient or visit not found.';
        } else if (err.message.includes('400')) {
          errorMessage = 'Invalid request. Please check your patient and visit information.';
        } else if (err.message.includes('500')) {
          errorMessage = 'Server error occurred while generating post-visit summary. Please check the backend logs for details.';
        } else if (err.message.includes('Backend error')) {
          // Extract the actual error from backend
          const match = err.message.match(/Backend error \d+: (.+)/);
          if (match) {
            try {
              const backendError = JSON.parse(match[1]);
              errorMessage = backendError.message || backendError.detail?.message || match[1];
            } catch {
              errorMessage = match[1];
            }
          } else {
            errorMessage = err.message;
          }
        } else {
          errorMessage = err.message;
        }
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleShareViaWhatsApp = () => {
    if (summary) {
      sharePostVisitSummaryViaWhatsApp(summary);
    }
  };

  const handleGoBack = () => {
    navigate(`/intake/${patientId}?v=${visitId}`);
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

  if (processing) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-6 text-center">
          <div className="w-10 h-10 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Generating post-visit summary…</h3>
          <p className="text-sm text-gray-600">This may take a few moments.</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Error Loading Summary</h3>
              <p className="text-gray-600 mb-4">{error}</p>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <p className="text-blue-800 text-sm">
                  <strong>Note:</strong> Post-visit summaries can only be generated after:
                  <br />• The intake process is completed
                  <br />• SOAP notes have been generated
                  <br />• The visit is marked as completed
                </p>
              </div>
              <div className="space-y-2">
                <Button onClick={loadPostVisitSummary} className="w-full">
                  Try Again
                </Button>
                <Button onClick={handleGoBack} variant="outline" className="w-full">
                  Go Back to Main Page
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <AlertCircle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No Summary Found</h3>
              <p className="text-gray-600 mb-4">Post-visit summary is not available for this visit.</p>
              <Button onClick={handleGoBack} className="w-full">
                Go Back
              </Button>
            </div>
          </CardContent>
        </Card>
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
            {language === 'sp' ? 'Volver a la Página Principal' : 'Back to Main Page'}
          </Button>
          
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                {language === 'sp' ? 'Resumen Post-Consulta' : 'Post-Visit Summary'}
              </h1>
              <p className="text-gray-600 mt-2">
                {language === 'sp' ? 'Resumen amigable para el paciente para compartir' : 'Patient-friendly summary for sharing'}
              </p>
            </div>
            <div className="flex space-x-2">
              <Button
                onClick={handleShareViaWhatsApp}
                className="bg-green-600 hover:bg-green-700"
              >
                <Share2 className="h-4 w-4 mr-2" />
                {t('summary.share_whatsapp')}
              </Button>
              <Button onClick={() => window.print()} variant="outline">
                <FileText className="h-4 w-4 mr-2" />
                {t('summary.print')}
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
                {t('postvisit.visit_date')}: {new Date(summary.visit_date).toLocaleDateString()}
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
            <CardTitle className="text-lg">{t('postvisit.chief_complaint')}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-700">{summary.chief_complaint || 'No chief complaint recorded'}</p>
          </CardContent>
        </Card>

        {/* Key Findings */}
        {summary.key_findings.length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg">{t('postvisit.key_findings')}</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {summary.key_findings.map((finding, index) => (
                  <li key={index} className="flex items-start">
                    <span className="text-green-600 mr-2 mt-1">•</span>
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
            <CardTitle className="text-lg">{t('postvisit.diagnosis')}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-700">{summary.diagnosis}</p>
          </CardContent>
        </Card>

        {/* Medications */}
        {summary.medications.length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg">{t('postvisit.medications_prescribed')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {summary.medications.map((med, index) => (
                  <div key={index} className="border rounded-lg p-4">
                    <h4 className="font-semibold text-gray-900 mb-2">{med.name}</h4>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div><span className="font-medium">{t('postvisit.dosage')}:</span> {med.dosage}</div>
                      <div><span className="font-medium">{t('postvisit.frequency')}:</span> {med.frequency}</div>
                      <div><span className="font-medium">{t('postvisit.duration')}:</span> {med.duration}</div>
                      {med.purpose && <div><span className="font-medium">{t('postvisit.purpose')}:</span> {med.purpose}</div>}
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
              <CardTitle className="text-lg">{t('postvisit.other_recommendations')}</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {summary.other_recommendations.map((rec, index) => (
                  <li key={index} className="flex items-start">
                    <span className="text-blue-600 mr-2 mt-1">•</span>
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
              <CardTitle className="text-lg">{t('postvisit.tests_ordered')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {summary.tests_ordered.map((test, index) => (
                  <div key={index} className="border rounded-lg p-4">
                    <h4 className="font-semibold text-gray-900 mb-2">{test.test_name}</h4>
                    <div className="text-sm space-y-1">
                      <div><span className="font-medium">{t('postvisit.purpose_simple')}:</span> {test.purpose}</div>
                      <div><span className="font-medium">{t('postvisit.instructions')}:</span> {test.instructions}</div>
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
              <CardTitle className="text-lg">{t('postvisit.next_appointment')}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-700">{summary.next_appointment}</p>
            </CardContent>
          </Card>
        )}

        {/* Red Flag Symptoms */}
        {summary.red_flag_symptoms.length > 0 && (
          <Card className="mb-6 border-red-200">
            <CardHeader className="bg-red-50">
              <CardTitle className="text-lg text-red-800 flex items-center">
                <AlertCircle className="h-5 w-5 mr-2" />
                {t('postvisit.warning_signs')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Alert className="border-red-200 bg-red-50">
                <AlertCircle className="h-4 w-4 text-red-600" />
                <AlertDescription className="text-red-800">
                  <p className="font-medium mb-2">{t('postvisit.seek_immediate_attention')}</p>
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
            <CardTitle className="text-lg">{t('postvisit.patient_instructions')}</CardTitle>
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

        {/* Reassurance Note */}
        <Card className="mb-6 border-blue-200">
          <CardHeader className="bg-blue-50">
            <CardTitle className="text-lg text-blue-800">{t('postvisit.closing_note')}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-blue-800 font-medium mb-2">{summary.reassurance_note}</p>
            <p className="text-blue-700 text-sm">📞 {t('postvisit.contact')}: {summary.clinic_contact}</p>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center text-sm text-gray-500 py-4">
          Generated on: {new Date(summary.generated_at).toLocaleString()}
        </div>
      </div>
    </div>
  );
};

export default PostVisitSummary;