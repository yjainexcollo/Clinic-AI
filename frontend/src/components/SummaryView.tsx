import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Alert, AlertDescription } from './ui/alert';
import { FileText, Calendar, User, Clock, X } from 'lucide-react';
import { getPreVisitSummary, BACKEND_BASE_URL } from '../services/patientService';
import { useLanguage } from '../contexts/LanguageContext';

interface SummaryViewProps {
  patientId: string;
  visitId: string;
  onClose: () => void;
}

interface SummaryData {
  patient_id: string;
  visit_id: string;
  summary: string;
  generated_at: string;
  medication_images?: Array<{ id: string; filename: string; content_type?: string }>;
}

export const SummaryView: React.FC<SummaryViewProps> = ({
  patientId,
  visitId,
  onClose
}) => {
  const [summaryData, setSummaryData] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const { language } = useLanguage();

  const loadSummary = async () => {
    try {
      setLoading(true);
      setError(null);

      const data = await getPreVisitSummary(patientId, visitId);
      setSummaryData(data);
    } catch (err) {
      console.error('Error loading summary:', err);
      setError(err instanceof Error ? err.message : 'Failed to load summary');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSummary();
  }, [patientId, visitId]);

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleString(language === 'sp' ? 'es-ES' : 'en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    } catch {
      return dateString;
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <Card className="w-full max-w-4xl max-h-[90vh] overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <div className="flex items-center space-x-2">
              <FileText className="h-6 w-6 text-blue-600" />
              <CardTitle>{language === 'sp' ? 'Resumen Pre-Consulta' : 'Pre-Visit Summary'}</CardTitle>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="h-8 w-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-600">{language === 'sp' ? 'Cargando su resumen pre-consulta...' : 'Loading your pre-visit summary...'}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <Card className="w-full max-w-4xl max-h-[90vh] overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <div className="flex items-center space-x-2">
              <FileText className="h-6 w-6 text-blue-600" />
              <CardTitle>{language === 'sp' ? 'Resumen Pre-Consulta' : 'Pre-Visit Summary'}</CardTitle>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent className="py-8">
            <Alert className="border-red-200 bg-red-50">
              <AlertDescription className="text-red-800">
                {error}
              </AlertDescription>
            </Alert>
            <div className="flex justify-center mt-6 space-x-3">
              <Button onClick={() => loadSummary()}>
                {language === 'sp' ? 'Intentar de nuevo' : 'Try Again'}
              </Button>
              <Button variant="outline" onClick={onClose}>
                {language === 'sp' ? 'Cerrar' : 'Close'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!summaryData) {
    return null;
  }

  // Format summary: bold known headings without showing markdown symbols
  const renderSummary = (text: string) => {
    const lines = (text || '').split(/\n+/);
    const headings = language === 'sp'
      ? [
          'Motivo de Consulta:',
          'HPI:',
          'Historia:',
          'Medicaciones actuales:',
          'Revisión de Sistemas:',
        ]
      : [
          'Chief Complaint:',
          'HPI:',
          'History:',
          'Current Medication:',
          'Review of Systems:',
        ];
    return (
      <div className="space-y-3">
        {lines.map((line, idx) => {
          const key = `l-${idx}`;
          const match = headings.find(h => line.startsWith(h));
          if (match) {
            const rest = line.slice(match.length).trimStart();
            return (
              <div key={key}>
                <strong>{match}</strong> {rest}
              </div>
            );
          }
          return <div key={key}>{line}</div>;
        })}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 border-b">
          <div className="flex items-center space-x-2">
            <FileText className="h-6 w-6 text-blue-600" />
            <div>
              <CardTitle>{language === 'sp' ? 'Resumen Pre-Consulta' : 'Pre-Visit Summary'}</CardTitle>
              <CardDescription>
                {language === 'sp' ? 'Resumen clínico generado por IA para su próxima cita' : 'AI-generated clinical summary for your upcoming appointment'}
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        
        <CardContent className="overflow-y-auto max-h-[calc(90vh-120px)]">
          {/* Summary Metadata */}
          <div className="flex flex-wrap gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center space-x-2">
              <User className="h-4 w-4 text-gray-500" />
              <span className="text-sm text-gray-600">{language === 'sp' ? 'ID del Paciente:' : 'Patient ID:'}</span>
              <Badge variant="secondary">{summaryData.patient_id}</Badge>
            </div>
            <div className="flex items-center space-x-2">
              <FileText className="h-4 w-4 text-gray-500" />
              <span className="text-sm text-gray-600">{language === 'sp' ? 'ID de la Visita:' : 'Visit ID:'}</span>
              <Badge variant="secondary">{summaryData.visit_id}</Badge>
            </div>
            <div className="flex items-center space-x-2">
              <Clock className="h-4 w-4 text-gray-500" />
              <span className="text-sm text-gray-600">{language === 'sp' ? 'Generado:' : 'Generated:'}</span>
              <span className="text-sm font-medium">{formatDate(summaryData.generated_at)}</span>
            </div>
          </div>

          {/* Summary Content */}
          <div className="prose prose-sm max-w-none">
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <FileText className="h-5 w-5 mr-2 text-blue-600" />
                {language === 'sp' ? 'Resumen Clínico' : 'Clinical Summary'}
              </h3>
              <div className="text-gray-700 whitespace-pre-wrap leading-relaxed">
                {renderSummary(summaryData.summary)}
              </div>
              {Array.isArray(summaryData.medication_images) && summaryData.medication_images.length > 0 && (
                <div className="mt-6">
                  <h4 className="text-sm font-semibold text-gray-800 mb-2">{language === 'sp' ? 'Imágenes de prescripción subidas' : 'Uploaded prescription images'}</h4>
                  <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
                    {summaryData.medication_images.map((img) => (
                      <div key={img.id} className="border rounded p-1 bg-gray-50">
                        <img
                          src={`${BACKEND_BASE_URL}/patients/images/${img.id}/content`}
                          alt={img.filename}
                          className="w-full h-24 object-cover rounded"
                        />
                        <div className="text-[11px] text-gray-600 mt-1 truncate" title={img.filename}>{img.filename}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-center mt-8 space-x-3">
            <Button onClick={() => window.print()} variant="outline">
              <FileText className="h-4 w-4 mr-2" />
              {language === 'sp' ? 'Imprimir Resumen' : 'Print Summary'}
            </Button>
            <Button onClick={onClose}>
              {language === 'sp' ? 'Cerrar' : 'Close'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SummaryView;
