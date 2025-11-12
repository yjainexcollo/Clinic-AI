import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { apiClient } from '../lib/api';
import { useAppStore } from '../lib/store';
import { Button } from '../components/ui/Button';
import { Loading } from '../components/ui/Loading';
import { Upload, Mic, Play, Pause, CheckCircle2, FileAudio, ArrowLeft } from 'lucide-react';

export const Transcription: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentPatient, currentVisit } = useAppStore();
  
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [transcript, setTranscript] = useState<string>('');
  const [audioUrl, setAudioUrl] = useState<string>('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  
  const audioRef = useRef<HTMLAudioElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const patientId = currentPatient?.patient_id || location.state?.patient_id;
  const visitId = currentVisit?.visit_id || location.state?.visit_id;

  // Poll for transcript
  const { data: transcriptData, isFetching: isPolling } = useQuery({
    queryKey: ['transcript', patientId, visitId],
    queryFn: () => apiClient.getTranscript(patientId!, visitId!),
    enabled: !!patientId && !!visitId && !!audioFile,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (data?.success && data?.data?.transcript) {
        return false; // Stop polling if transcript exists
      }
      return 60000; // Poll every 60s (1 minute) if no transcript yet
    },
  });

  useEffect(() => {
    if (transcriptData?.success && transcriptData.data?.transcript) {
      setTranscript(transcriptData.data.transcript);
    }
  }, [transcriptData]);

  useEffect(() => {
    if (!patientId || !visitId) {
      navigate('/');
    }
  }, [patientId, visitId, navigate]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateProgress = () => {
      if (audio.duration) {
        setProgress((audio.currentTime / audio.duration) * 100);
      }
    };

    audio.addEventListener('timeupdate', updateProgress);
    audio.addEventListener('ended', () => setIsPlaying(false));

    return () => {
      audio.removeEventListener('timeupdate', updateProgress);
      audio.removeEventListener('ended', () => setIsPlaying(false));
    };
  }, [audioUrl]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 50 * 1024 * 1024) {
        toast.error('File size must be less than 50MB');
        return;
      }
      setAudioFile(file);
      const url = URL.createObjectURL(file);
      setAudioUrl(url);
      toast.success('Audio file selected');
    }
  };

  const transcribeMutation = useMutation({
    mutationFn: (file: File) => 
      apiClient.transcribeAudio(patientId!, visitId!, file, currentPatient?.language || 'en'),
    onSuccess: (response) => {
      if (response.success) {
        toast.success('Transcription started! Processing may take a few moments.');
      } else {
        toast.error(response.error || 'Transcription failed');
      }
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to transcribe audio');
    },
  });

  const handleTranscribe = () => {
    if (!audioFile || !patientId || !visitId) return;
    transcribeMutation.mutate(audioFile);
  };

  const handlePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleContinue = () => {
    navigate('/soap', {
      state: { patient_id: patientId, visit_id: visitId },
    });
  };

  const isProcessing = isPolling && !transcript;

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
              <Mic className="h-7 w-7 text-white" />
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-gray-900">Audio Transcription</h1>
              <p className="text-gray-600 mt-1">Upload consultation audio for AI-powered transcription</p>
            </div>
          </div>
        </div>

        {transcript ? (
          <div className="medical-card space-y-6">
            <div className="flex items-center space-x-3 mb-6">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <CheckCircle2 className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Transcription Complete</h2>
                <p className="text-sm text-gray-600">Your audio has been successfully transcribed</p>
              </div>
            </div>
            
            <div className="bg-gray-50 border-2 border-gray-200 rounded-xl p-6 max-h-96 overflow-y-auto">
              <p className="text-gray-800 whitespace-pre-wrap leading-relaxed">{transcript}</p>
            </div>
            
            <div className="flex gap-4 pt-4 border-t border-gray-200">
              <Button onClick={handleContinue} className="flex-1" size="lg">
                Continue to SOAP Note Generation
                <ArrowRight className="h-5 w-5 ml-2" />
              </Button>
            </div>
          </div>
        ) : (
          <div className="medical-card">
            {transcribeMutation.isPending || isProcessing ? (
              <div className="py-12">
                <Loading message="Transcribing audio... This may take a few moments." />
              </div>
            ) : audioFile ? (
              <div className="space-y-6">
                <div className="border-2 border-gray-200 rounded-xl p-6 bg-gray-50">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-4">
                      <div className="w-14 h-14 bg-[#2E86AB] rounded-xl flex items-center justify-center shadow-md">
                        <FileAudio className="h-7 w-7 text-white" />
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">{audioFile.name}</p>
                        <p className="text-sm text-gray-600">
                          {(audioFile.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                    </div>
                    {audioUrl && (
                      <button
                        onClick={handlePlay}
                        className="p-4 bg-[#2E86AB] text-white rounded-xl hover:bg-[#1e5f7a] transition-colors shadow-md"
                      >
                        {isPlaying ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6" />}
                      </button>
                    )}
                  </div>
                  {audioUrl && (
                    <>
                      <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                        <div
                          className="h-2 bg-[#2E86AB] rounded-full transition-all"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <audio ref={audioRef} src={audioUrl} className="hidden" />
                    </>
                  )}
                </div>

                <div className="flex gap-4">
                  <Button
                    onClick={handleTranscribe}
                    className="flex-1"
                    isLoading={transcribeMutation.isPending}
                    size="lg"
                  >
                    <Upload className="h-5 w-5 mr-2" />
                    Transcribe Audio
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setAudioFile(null);
                      setAudioUrl('');
                      if (fileInputRef.current) {
                        fileInputRef.current.value = '';
                      }
                    }}
                    size="lg"
                  >
                    Change File
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="inline-flex items-center justify-center w-24 h-24 bg-[#2E86AB] rounded-2xl shadow-lg mb-6">
                  <Mic className="h-12 w-12 text-white" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">
                  Upload Consultation Audio
                </h3>
                <p className="text-gray-600 mb-8 max-w-md mx-auto">
                  Select an audio file from your device to begin transcription. 
                  Our AI will convert your audio into accurate text.
                </p>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="audio/*"
                  onChange={handleFileSelect}
                  className="hidden"
                />

                <Button
                  onClick={() => fileInputRef.current?.click()}
                  size="lg"
                  className="mb-4"
                >
                  <Upload className="h-5 w-5 mr-2" />
                  Select Audio File
                </Button>

                <p className="text-sm text-gray-500">
                  Supported formats: MP3, WAV, M4A (Max 50MB)
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
