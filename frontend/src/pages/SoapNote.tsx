import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { apiClient } from '../lib/api';
import type { VitalsRequest } from '../lib/api';
import { useAppStore } from '../lib/store';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Loading } from '../components/ui/Loading';
import { FileText, Activity, Plus, ArrowLeft } from 'lucide-react';

export const SoapNote: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentPatient, currentVisit } = useAppStore();
  
  const [vitals, setVitals] = useState({
    blood_pressure: '',
    heart_rate: '',
    temperature: '',
    respiratory_rate: '',
    oxygen_saturation: '',
    weight: '',
    height: '',
  });
  const [showVitalsForm, setShowVitalsForm] = useState(false);

  const patientId = currentPatient?.patient_id || location.state?.patient_id;
  const visitId = currentVisit?.visit_id || location.state?.visit_id;

  // Load SOAP note
  const { data: soapData, isLoading: isLoadingSoap, refetch: refetchSoap } = useQuery({
    queryKey: ['soap-note', patientId, visitId],
    queryFn: () => apiClient.getSoapNote(patientId!, visitId!),
    enabled: !!patientId && !!visitId,
  });

  // Load vitals
  const { data: vitalsData, refetch: refetchVitals } = useQuery({
    queryKey: ['vitals', patientId, visitId],
    queryFn: () => apiClient.getVitals(patientId!, visitId!),
    enabled: !!patientId && !!visitId,
  });

  useEffect(() => {
    if (!patientId || !visitId) {
      navigate('/');
    }
  }, [patientId, visitId, navigate]);

  useEffect(() => {
    if (vitalsData?.success && vitalsData.data?.vitals) {
      const v = vitalsData.data.vitals;
      setVitals({
        blood_pressure: v.blood_pressure || '',
        heart_rate: v.heart_rate?.toString() || '',
        temperature: v.temperature?.toString() || '',
        respiratory_rate: v.respiratory_rate?.toString() || '',
        oxygen_saturation: v.oxygen_saturation?.toString() || '',
        weight: v.weight?.toString() || '',
        height: v.height?.toString() || '',
      });
    }
  }, [vitalsData]);

  const generateSoapMutation = useMutation({
    mutationFn: () => apiClient.generateSoapNote({
      patient_id: patientId!,
      visit_id: visitId!,
    }),
    onSuccess: (response) => {
      if (response.success && response.data) {
        toast.success('SOAP note generated successfully!');
        refetchSoap();
      } else {
        toast.error(response.error || 'Failed to generate SOAP note');
      }
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to generate SOAP note');
    },
  });

  const saveVitalsMutation = useMutation({
    mutationFn: (data: VitalsRequest) => apiClient.storeVitals(data),
    onSuccess: () => {
      toast.success('Vitals saved successfully!');
      setShowVitalsForm(false);
      refetchVitals();
      refetchSoap();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to save vitals');
    },
  });

  const handleVitalsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setVitals((prev) => ({ ...prev, [name]: value }));
  };

  const handleSaveVitals = (e: React.FormEvent) => {
    e.preventDefault();
    const vitalsData: VitalsRequest = {
      patient_id: patientId!,
      visit_id: visitId!,
      vitals: {
        blood_pressure: vitals.blood_pressure || undefined,
        heart_rate: vitals.heart_rate ? parseInt(vitals.heart_rate) : undefined,
        temperature: vitals.temperature ? parseFloat(vitals.temperature) : undefined,
        respiratory_rate: vitals.respiratory_rate ? parseInt(vitals.respiratory_rate) : undefined,
        oxygen_saturation: vitals.oxygen_saturation ? parseInt(vitals.oxygen_saturation) : undefined,
        weight: vitals.weight ? parseFloat(vitals.weight) : undefined,
        height: vitals.height ? parseFloat(vitals.height) : undefined,
      },
    };
    saveVitalsMutation.mutate(vitalsData);
  };

  if (!patientId || !visitId) {
    return null;
  }

  const soapNote = soapData?.success ? soapData.data?.soap_note : null;
  const existingVitals = vitalsData?.success ? vitalsData.data?.vitals : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-medical-primary-light to-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <button
            onClick={() => navigate('/')}
            className="flex items-center text-gray-600 hover:text-gray-900 transition-colors mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </button>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">SOAP Note</h1>
          <p className="text-gray-600">Medical documentation from consultation</p>
        </div>

        {/* Vitals Section */}
        <div className="medical-card mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Activity className="h-5 w-5 text-medical-primary" />
              Objective Vitals
            </h2>
            {!showVitalsForm && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowVitalsForm(true)}
              >
                <Plus className="h-4 w-4 mr-2" />
                {existingVitals ? 'Edit' : 'Add'} Vitals
              </Button>
            )}
          </div>

          {existingVitals && !showVitalsForm ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {existingVitals.blood_pressure && (
                <div>
                  <p className="text-sm text-gray-600">Blood Pressure</p>
                  <p className="text-lg font-semibold">{existingVitals.blood_pressure}</p>
                </div>
              )}
              {existingVitals.heart_rate && (
                <div>
                  <p className="text-sm text-gray-600">Heart Rate</p>
                  <p className="text-lg font-semibold">{existingVitals.heart_rate} bpm</p>
                </div>
              )}
              {existingVitals.temperature && (
                <div>
                  <p className="text-sm text-gray-600">Temperature</p>
                  <p className="text-lg font-semibold">{existingVitals.temperature}°C</p>
                </div>
              )}
              {existingVitals.oxygen_saturation && (
                <div>
                  <p className="text-sm text-gray-600">SpO2</p>
                  <p className="text-lg font-semibold">{existingVitals.oxygen_saturation}%</p>
                </div>
              )}
            </div>
          ) : showVitalsForm ? (
            <form onSubmit={handleSaveVitals} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Blood Pressure"
                  name="blood_pressure"
                  value={vitals.blood_pressure}
                  onChange={handleVitalsChange}
                  placeholder="120/80"
                />
                <Input
                  label="Heart Rate (bpm)"
                  name="heart_rate"
                  type="number"
                  value={vitals.heart_rate}
                  onChange={handleVitalsChange}
                  placeholder="72"
                />
                <Input
                  label="Temperature (°C)"
                  name="temperature"
                  type="number"
                  step="0.1"
                  value={vitals.temperature}
                  onChange={handleVitalsChange}
                  placeholder="37.0"
                />
                <Input
                  label="Respiratory Rate"
                  name="respiratory_rate"
                  type="number"
                  value={vitals.respiratory_rate}
                  onChange={handleVitalsChange}
                  placeholder="16"
                />
                <Input
                  label="Oxygen Saturation (%)"
                  name="oxygen_saturation"
                  type="number"
                  value={vitals.oxygen_saturation}
                  onChange={handleVitalsChange}
                  placeholder="98"
                />
                <Input
                  label="Weight (kg)"
                  name="weight"
                  type="number"
                  step="0.1"
                  value={vitals.weight}
                  onChange={handleVitalsChange}
                  placeholder="70"
                />
                <Input
                  label="Height (cm)"
                  name="height"
                  type="number"
                  value={vitals.height}
                  onChange={handleVitalsChange}
                  placeholder="170"
                />
              </div>
              <div className="flex gap-4">
                <Button
                  type="submit"
                  isLoading={saveVitalsMutation.isPending}
                  className="flex-1"
                >
                  Save Vitals
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowVitalsForm(false)}
                >
                  Cancel
                </Button>
              </div>
            </form>
          ) : (
            <p className="text-gray-600">No vitals recorded yet</p>
          )}
        </div>

        {/* SOAP Note */}
        {isLoadingSoap ? (
          <div className="medical-card">
            <Loading message="Loading SOAP note..." />
          </div>
        ) : soapNote ? (
          <div className="medical-card space-y-6">
            <div>
              <div className="flex items-center space-x-2 mb-3">
                <FileText className="h-5 w-5 text-medical-primary" />
                <h2 className="text-lg font-semibold text-gray-900">Subjective</h2>
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <p className="text-gray-800 whitespace-pre-wrap">{soapNote.subjective || 'Not documented'}</p>
              </div>
            </div>

            <div>
              <div className="flex items-center space-x-2 mb-3">
                <Activity className="h-5 w-5 text-medical-primary" />
                <h2 className="text-lg font-semibold text-gray-900">Objective</h2>
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                {soapNote.objective && typeof soapNote.objective === 'object' ? (
                  <div className="space-y-3">
                    {soapNote.objective.vital_signs && (
                      <div>
                        <h4 className="font-medium text-gray-700 mb-2">Vital Signs</h4>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          {Object.entries(soapNote.objective.vital_signs).map(([key, value]) => (
                            <div key={key} className="flex justify-between">
                              <span className="text-gray-600 capitalize">{key.replace(/_/g, ' ')}:</span>
                              <span className="text-gray-900">{String(value)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {soapNote.objective.physical_exam && (
                      <div>
                        <h4 className="font-medium text-gray-700 mb-2">Physical Exam</h4>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          {Object.entries(soapNote.objective.physical_exam).map(([key, value]) => (
                            <div key={key} className="flex justify-between">
                              <span className="text-gray-600 capitalize">{key.replace(/_/g, ' ')}:</span>
                              <span className="text-gray-900">{String(value)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-gray-800 whitespace-pre-wrap">{String(soapNote.objective || 'Not documented')}</p>
                )}
              </div>
            </div>

            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-3">Assessment</h2>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <p className="text-gray-800 whitespace-pre-wrap">{soapNote.assessment || 'Not documented'}</p>
              </div>
            </div>

            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-3">Plan</h2>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <p className="text-gray-800 whitespace-pre-wrap">{soapNote.plan || 'Not documented'}</p>
              </div>
            </div>

            {soapNote.red_flags && soapNote.red_flags.length > 0 && (
              <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4">
                <h3 className="font-semibold text-red-900 mb-2">Red Flags</h3>
                <ul className="list-disc list-inside space-y-1">
                  {soapNote.red_flags.map((flag: string, index: number) => (
                    <li key={index} className="text-red-800">{flag}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex gap-4 pt-6 border-t border-gray-200">
              <Button
                onClick={() => navigate('/post-visit-summary', {
                  state: { patient_id: patientId, visit_id: visitId },
                })}
                className="flex-1"
                size="lg"
              >
                Continue to Post-Visit Summary
              </Button>
            </div>
          </div>
        ) : (
          <div className="medical-card text-center py-12">
            <FileText className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No SOAP Note Generated</h3>
            <p className="text-gray-600 mb-6">
              Generate a SOAP note from the consultation transcript and vitals data.
            </p>
            <Button
              onClick={() => generateSoapMutation.mutate()}
              isLoading={generateSoapMutation.isPending}
              size="lg"
            >
              Generate SOAP Note
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
