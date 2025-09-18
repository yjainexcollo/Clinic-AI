import React, { useState } from 'react';
import { Alert, AlertDescription } from './ui/alert';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui/collapsible';
import { ChevronDown, ChevronUp, Upload, AlertTriangle, CheckCircle, XCircle, Info } from 'lucide-react';
import { OCRQualityInfo } from '../services/patientService';

interface OCRQualityFeedbackProps {
  ocrQuality: OCRQualityInfo;
  onReupload: () => void;
  onProceed: () => void;
  isUploading?: boolean;
}

const QualityIcon = ({ quality }: { quality: string }) => {
  switch (quality) {
    case 'excellent':
      return <CheckCircle className="h-5 w-5 text-green-500" />;
    case 'good':
      return <CheckCircle className="h-5 w-5 text-blue-500" />;
    case 'poor':
      return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
    case 'failed':
      return <XCircle className="h-5 w-5 text-red-500" />;
    default:
      return <Info className="h-5 w-5 text-gray-500" />;
  }
};

const QualityColor = (quality: string) => {
  switch (quality) {
    case 'excellent':
      return 'bg-green-100 text-green-800 border-green-200';
    case 'good':
      return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'poor':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'failed':
      return 'bg-red-100 text-red-800 border-red-200';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

export const OCRQualityFeedback: React.FC<OCRQualityFeedbackProps> = ({
  ocrQuality,
  onReupload,
  onProceed,
  isUploading = false
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const shouldShowReupload = ocrQuality.quality === 'poor' || ocrQuality.quality === 'failed';
  const shouldShowWarning = ocrQuality.quality === 'poor' || ocrQuality.quality === 'failed';

  return (
    <div className="space-y-4">
      {/* Main Quality Alert */}
      <Alert className={shouldShowWarning ? 'border-yellow-200 bg-yellow-50' : 'border-blue-200 bg-blue-50'}>
        <QualityIcon quality={ocrQuality.quality} />
        <AlertDescription className="flex items-center justify-between">
          <div>
            <span className="font-medium">
              OCR Quality: {ocrQuality.quality.charAt(0).toUpperCase() + ocrQuality.quality.slice(1)}
            </span>
            <span className="ml-2 text-sm text-gray-600">
              (Confidence: {Math.round(ocrQuality.confidence * 100)}%)
            </span>
          </div>
          <Badge className={QualityColor(ocrQuality.quality)}>
            {ocrQuality.quality.toUpperCase()}
          </Badge>
        </AlertDescription>
      </Alert>

      {/* Extracted Text Preview */}
      {ocrQuality.extracted_text && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Extracted Text</CardTitle>
            <CardDescription className="text-xs">
              {ocrQuality.word_count} words • {ocrQuality.extracted_medications.length} medication(s) found
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="bg-gray-50 p-3 rounded-md text-sm font-mono">
              {ocrQuality.extracted_text}
            </div>
            {ocrQuality.extracted_medications.length > 0 && (
              <div className="mt-2">
                <span className="text-xs font-medium text-gray-600">Medications detected:</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {ocrQuality.extracted_medications.map((med, index) => (
                    <Badge key={index} variant="secondary" className="text-xs">
                      {med}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Suggestions */}
      {ocrQuality.suggestions.length > 0 && (
        <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
          <CollapsibleTrigger asChild>
            <Button variant="outline" className="w-full justify-between">
              <span>View Suggestions & Tips</span>
              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2">
            <Card>
              <CardContent className="pt-4">
                <ul className="space-y-2 text-sm">
                  {ocrQuality.suggestions.map((suggestion, index) => (
                    <li key={index} className="flex items-start">
                      <span className="text-gray-400 mr-2">•</span>
                      <span>{suggestion}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3">
        {shouldShowReupload && (
          <Button
            onClick={onReupload}
            disabled={isUploading}
            variant="outline"
            className="flex-1"
          >
            <Upload className="h-4 w-4 mr-2" />
            {isUploading ? 'Uploading...' : 'Re-upload Image'}
          </Button>
        )}
        <Button
          onClick={onProceed}
          disabled={isUploading}
          className={`flex-1 ${shouldShowReupload ? '' : 'w-full'}`}
        >
          {ocrQuality.quality === 'failed' ? 'Continue Without OCR' : 'Continue'}
        </Button>
      </div>

      {/* Quality Assessment Summary */}
      <div className="text-xs text-gray-500 space-y-1">
        <div className="flex justify-between">
          <span>Confidence Score:</span>
          <span className="font-medium">{Math.round(ocrQuality.confidence * 100)}%</span>
        </div>
        <div className="flex justify-between">
          <span>Medication Keywords:</span>
          <span className="font-medium">{ocrQuality.has_medication_keywords ? 'Yes' : 'No'}</span>
        </div>
        <div className="flex justify-between">
          <span>Words Extracted:</span>
          <span className="font-medium">{ocrQuality.word_count}</span>
        </div>
      </div>
    </div>
  );
};

export default OCRQualityFeedback;
