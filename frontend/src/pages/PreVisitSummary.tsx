import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiClient } from '../lib/api';
import { Button } from '../components/ui/button';
import { FileText, AlertTriangle, ArrowRight, ArrowLeft, Image as ImageIcon } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

export const PreVisitSummary: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState<string | null>(null);
  const { t, language } = useLanguage();

  const patientId = location.state?.patient_id;
  const visitId = location.state?.visit_id;

  // Generate or get pre-visit summary
  const generateSummaryMutation = useMutation({
    mutationFn: () => apiClient.generatePreVisitSummary(patientId!, visitId!),
    onSuccess: () => {
      refetchSummary();
      setError(null);
    },
    onError: (error: any) => {
      setError(error.response?.data?.message || 'Failed to generate summary');
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
    // Navigate to vitals form after pre-visit summary (scheduled flow)
    navigate(`/vitals/${encodeURIComponent(patientId!)}/${encodeURIComponent(visitId!)}`, {
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
          <div className="flex flex-col items-center justify-center py-12">
            <div className="w-12 h-12 border-4 border-[#2E86AB] border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-gray-600 text-lg">Generating pre-visit summary...</p>
          </div>
        </div>
      </div>
    );
  }

  const summary = summaryData?.success ? summaryData.data : null;

  // Localize common section headings inside the generated summary text for Spanish users
  const translateSummaryText = (text: string | undefined | null): string => {
    if (!text) return '';
    if (language !== 'sp') return text;
    
    // Match headings anywhere in the text
    // Order matters: replace "Current Medication" first, then "Medication" to avoid double replacement
    let output = text;
    
    // Chief Complaint
    output = output.replace(/Chief Complaint\s*:/gi, `${t('previsit.heading.chief_complaint')}:`);
    
    // HPI
    output = output.replace(/HPI\s*:/gi, `${t('previsit.heading.hpi')}:`);
    
    // History
    output = output.replace(/History\s*:/gi, `${t('previsit.heading.history')}:`);
    
    // Current Medication(s) - must come before "Medication" to avoid partial matches
    output = output.replace(/Current Medication[s]?\s*:/gi, `${t('previsit.heading.current_medication')}:`);
    
    // Medications (standalone) - only match if not already replaced by "Current Medication"
    output = output.replace(/\bMedications?\s*:/gi, `${t('previsit.heading.current_medication')}:`);
    
    // Plan
    output = output.replace(/Plan\s*:/gi, `${t('previsit.heading.plan')}:`);
    
    return output;
  };

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
            {t('previsit.back_home')}
          </button>
          
          <div className="flex items-center space-x-4 mb-2">
            <div className="w-14 h-14 bg-[#2E86AB] rounded-xl flex items-center justify-center shadow-lg">
              <FileText className="h-7 w-7 text-white" />
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-gray-900">{t('previsit.title')}</h1>
              <p className="text-gray-600 mt-1">{t('previsit.subtitle')}</p>
            </div>
          </div>
        </div>

        <div className="medical-card space-y-8">
          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border-2 border-red-300 rounded-xl p-4 mb-6">
              <div className="flex items-center space-x-3">
                <AlertTriangle className="h-5 w-5 text-red-600" />
                <p className="text-red-800">{error}</p>
              </div>
            </div>
          )}

          {summary ? (
            <>
              {/* Summary */}
              <div>
                <div className="flex items-center space-x-3 mb-4">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <FileText className="h-5 w-5 text-blue-600" />
                  </div>
                  <h2 className="text-xl font-semibold text-gray-900">{t('previsit.clinical_summary')}</h2>
                </div>
                <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-6">
                  <p className="text-gray-800 whitespace-pre-wrap leading-relaxed">
                    {translateSummaryText(summary.summary)}
                  </p>
                </div>
              </div>

              {/* Red Flags */}
              {summary.red_flags && summary.red_flags.length > 0 && (
                <div className="bg-red-50 border-2 border-red-300 rounded-xl p-6">
                  <div className="flex items-center space-x-3 mb-4">
                    <AlertTriangle className="h-6 w-6 text-red-600" />
                    <h3 className="text-lg font-semibold text-red-900">{t('previsit.red_flags')}</h3>
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
                    <h3 className="text-xl font-semibold text-gray-900">{t('previsit.medication_images')}</h3>
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
              <p className="text-gray-600 mb-6">{t('previsit.no_summary')}</p>
              <div className="flex flex-col items-center justify-center mt-4">
                <div className="w-12 h-12 border-4 border-[#2E86AB] border-t-transparent rounded-full animate-spin mb-4"></div>
                <p className="text-gray-600">{t('previsit.generating_summary')}</p>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-4 pt-6 border-t border-gray-200">
            <Button 
              onClick={handleContinue} 
              className="flex-1" 
              size="lg"
            >
              {t('previsit.continue_vitals')}
              <ArrowRight className="h-5 w-5 ml-2" />
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate('/')}
              size="lg"
            >
              {t('previsit.back_home')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PreVisitSummary;
