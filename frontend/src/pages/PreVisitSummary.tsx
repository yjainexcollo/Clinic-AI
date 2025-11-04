import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { apiClient } from '../lib/api';
import { useAppStore } from '../lib/store';
import { Button } from '../components/ui/Button';
import { Loading } from '../components/ui/Loading';
import { FileText, AlertTriangle, ArrowRight, ArrowLeft, Image as ImageIcon } from 'lucide-react';

export const PreVisitSummary: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentPatient, currentVisit } = useAppStore();

  const patientId = currentPatient?.patient_id || location.state?.patient_id;
  const visitId = currentVisit?.visit_id || location.state?.visit_id;

  // Generate or get pre-visit summary
  const generateSummaryMutation = useMutation({
    mutationFn: () => apiClient.generatePreVisitSummary(patientId!, visitId!),
    onSuccess: () => {
      refetchSummary();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to generate summary');
    },
  });

  const { data: summaryData, isLoading, refetch: refetchSummary } = useQuery({
    queryKey: ['pre-visit-summary', patientId, visitId],
    queryFn: () => apiClient.getPreVisitSummary(patientId!, visitId!),
    enabled: !!patientId && !!visitId,
    retry: false,
  });

  useEffect(() => {
    if (!patientId || !visitId) {
      navigate('/');
    }
    
    // Auto-generate if not exists
    if (!isLoading && !summaryData?.success && !generateSummaryMutation.isPending) {
      generateSummaryMutation.mutate();
    }
  }, [patientId, visitId, navigate, isLoading, summaryData, generateSummaryMutation.isPending]);

  const handleContinue = () => {
    navigate('/transcription', {
      state: { patient_id: patientId, visit_id: visitId },
    });
  };

  if (!patientId || !visitId) {
    return null;
  }

  if (isLoading || generateSummaryMutation.isPending) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#e6f3f8] to-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <Loading message="Generating pre-visit summary..." />
        </div>
      </div>
    );
  }

  const summary = summaryData?.success ? summaryData.data : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#e6f3f8] to-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate('/')}
            className="inline-flex items-center text-gray-600 hover:text-gray-900 transition-colors mb-6 group"
          >
            <ArrowLeft className="h-4 w-4 mr-2 group-hover:-translate-x-1 transition-transform" />
            Back to Home
          </button>
          
          <div className="flex items-center space-x-4 mb-2">
            <div className="w-14 h-14 bg-[#2E86AB] rounded-xl flex items-center justify-center shadow-lg">
              <FileText className="h-7 w-7 text-white" />
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-gray-900">Pre-Visit Summary</h1>
              <p className="text-gray-600 mt-1">Clinical summary prepared for the doctor</p>
            </div>
          </div>
        </div>

        <div className="medical-card space-y-8">
          {summary ? (
            <>
              {/* Summary */}
              <div>
                <div className="flex items-center space-x-3 mb-4">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <FileText className="h-5 w-5 text-blue-600" />
                  </div>
                  <h2 className="text-xl font-semibold text-gray-900">Clinical Summary</h2>
                </div>
                <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-6">
                  <p className="text-gray-800 whitespace-pre-wrap leading-relaxed">{summary.summary}</p>
                </div>
              </div>

              {/* Red Flags */}
              {summary.red_flags && summary.red_flags.length > 0 && (
                <div className="bg-red-50 border-2 border-red-300 rounded-xl p-6">
                  <div className="flex items-center space-x-3 mb-4">
                    <AlertTriangle className="h-6 w-6 text-red-600" />
                    <h3 className="text-lg font-semibold text-red-900">Red Flags</h3>
                  </div>
                  <ul className="space-y-2">
                    {summary.red_flags.map((flag: any, index: number) => (
                      <li key={index} className="flex items-start space-x-2">
                        <span className="text-red-600 mt-1">•</span>
                        <span className="text-red-800">
                          {typeof flag === 'object' ? flag.flag || flag.description : flag}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Medication Images */}
              {summary.medication_images && summary.medication_images.length > 0 && (
                <div>
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                      <ImageIcon className="h-5 w-5 text-green-600" />
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900">Medication Images</h3>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {summary.medication_images.map((img: any) => (
                      <div key={img.id} className="relative group">
                        <img
                          src={`${import.meta.env?.VITE_API_URL || 'http://localhost:8000'}/patients/${patientId}/visits/${visitId}/intake-images/${img.id}/content`}
                          alt={img.filename || 'Medication image'}
                          className="w-full h-32 sm:h-40 object-cover rounded-lg border-2 border-gray-200 hover:border-[#2E86AB] transition-colors shadow-sm"
                        />
                        {img.filename && (
                          <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs p-2 rounded-b-lg opacity-0 group-hover:opacity-100 transition-opacity truncate">
                            {img.filename}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-12">
              <FileText className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 mb-6">No summary available. Generating...</p>
              <Loading message="Generating summary..." />
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-4 pt-6 border-t border-gray-200">
            <Button 
              onClick={handleContinue} 
              className="flex-1" 
              size="lg"
            >
              Continue to Transcription
              <ArrowRight className="h-5 w-5 ml-2" />
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate('/')}
              size="lg"
            >
              Back to Home
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
