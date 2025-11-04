import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { apiClient } from '../lib/api';
import type { RegisterPatientRequest } from '../lib/api';
import { useAppStore } from '../lib/store';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { UserPlus, ArrowLeft, CheckCircle2 } from 'lucide-react';

export const RegisterPatient: React.FC = () => {
  const navigate = useNavigate();
  const { setCurrentPatient, setCurrentVisit } = useAppStore();
  
  const [formData, setFormData] = useState<RegisterPatientRequest>({
    first_name: '',
    last_name: '',
    mobile: '',
    age: 0,
    gender: '',
    recently_travelled: false,
    consent: false,
    country: 'US',
    language: 'en',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 2;

  const registerMutation = useMutation({
    mutationFn: (data: RegisterPatientRequest) => apiClient.registerPatient(data),
    onSuccess: (response) => {
      if (response.success && response.data) {
        setCurrentPatient({
          patient_id: response.data.patient_id,
          name: `${formData.first_name} ${formData.last_name}`,
          age: formData.age,
          gender: formData.gender,
          mobile: formData.mobile,
          language: formData.language,
        });

        setCurrentVisit({
          visit_id: response.data.visit_id,
          patient_id: response.data.patient_id,
          status: 'intake',
          workflow_type: 'SCHEDULED',
        });

        toast.success('Patient registered successfully!');
        navigate('/intake', {
          state: {
            patient_id: response.data.patient_id,
            visit_id: response.data.visit_id,
            first_question: response.data.first_question,
          },
        });
      } else {
        toast.error(response.error || response.message || 'Registration failed');
      }
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to register patient. Please try again.');
    },
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;

    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));

    if (errors[name]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const validateStep = (step: number): boolean => {
    const newErrors: Record<string, string> = {};

    if (step === 1) {
      if (!formData.first_name.trim()) newErrors.first_name = 'First name is required';
      if (!formData.last_name.trim()) newErrors.last_name = 'Last name is required';
      if (!formData.mobile.trim()) newErrors.mobile = 'Mobile number is required';
      if (formData.age <= 0 || formData.age > 120) newErrors.age = 'Age must be between 1 and 120';
      if (!formData.gender) newErrors.gender = 'Gender is required';
    }

    if (step === 2) {
      if (!formData.consent) newErrors.consent = 'Consent is required to proceed';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(1)) {
      setCurrentStep(2);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleBack = () => {
    setCurrentStep(1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateStep(2)) return;

    registerMutation.mutate(formData);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#e6f3f8] to-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate('/')}
            className="inline-flex items-center text-gray-600 hover:text-gray-900 transition-colors mb-6 group"
          >
            <ArrowLeft className="h-4 w-4 mr-2 group-hover:-translate-x-1 transition-transform" />
            Back to Home
          </button>
          
          <div className="flex items-center space-x-4 mb-6">
            <div className="w-14 h-14 bg-[#2E86AB] rounded-xl flex items-center justify-center shadow-lg">
              <UserPlus className="h-7 w-7 text-white" />
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-gray-900">Register New Patient</h1>
              <p className="text-gray-600 mt-1">Step {currentStep} of {totalSteps}</p>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
            <div
              className="h-full bg-[#2E86AB] rounded-full transition-all duration-500 ease-out"
              style={{ width: `${(currentStep / totalSteps) * 100}%` }}
            />
          </div>
        </div>

        <div className="medical-card">
          <form onSubmit={currentStep === 2 ? handleSubmit : (e) => { e.preventDefault(); handleNext(); }} className="space-y-8">
            {currentStep === 1 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 mb-1">Patient Information</h2>
                  <p className="text-sm text-gray-600">Please provide the following details</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <Input
                    label="First Name *"
                    name="first_name"
                    value={formData.first_name}
                    onChange={handleChange}
                    error={errors.first_name}
                    placeholder="John"
                    required
                  />
                  <Input
                    label="Last Name *"
                    name="last_name"
                    value={formData.last_name}
                    onChange={handleChange}
                    error={errors.last_name}
                    placeholder="Doe"
                    required
                  />
                </div>

                <Input
                  label="Mobile Number *"
                  name="mobile"
                  type="tel"
                  value={formData.mobile}
                  onChange={handleChange}
                  error={errors.mobile}
                  placeholder="+1 (555) 123-4567"
                  required
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <Input
                    label="Age *"
                    name="age"
                    type="number"
                    min="1"
                    max="120"
                    value={formData.age || ''}
                    onChange={handleChange}
                    error={errors.age}
                    placeholder="25"
                    required
                  />
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Gender *
                    </label>
                    <select
                      name="gender"
                      value={formData.gender}
                      onChange={handleChange}
                      className={`medical-select ${errors.gender ? 'border-red-300 focus:border-red-500 focus:ring-red-500/20' : ''}`}
                      required
                    >
                      <option value="">Select gender</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                      <option value="prefer_not_to_say">Prefer not to say</option>
                    </select>
                    {errors.gender && (
                      <p className="mt-1 text-sm text-red-600">{errors.gender}</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Language *
                    </label>
                    <select
                      name="language"
                      value={formData.language}
                      onChange={handleChange}
                      className="medical-select"
                      required
                    >
                      <option value="en">English</option>
                      <option value="sp">Spanish</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Country *
                    </label>
                    <select
                      name="country"
                      value={formData.country}
                      onChange={handleChange}
                      className="medical-select"
                      required
                    >
                      <option value="US">United States</option>
                      <option value="CA">Canada</option>
                      <option value="MX">Mexico</option>
                      <option value="ES">Spain</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <input
                    type="checkbox"
                    name="recently_travelled"
                    checked={formData.recently_travelled}
                    onChange={handleChange}
                    className="h-5 w-5 text-[#2E86AB] focus:ring-[#2E86AB] border-gray-300 rounded cursor-pointer"
                  />
                  <label className="ml-3 block text-sm text-gray-700 cursor-pointer">
                    Recently travelled outside the country
                  </label>
                </div>

                <div className="flex justify-end pt-4 border-t border-gray-200">
                  <Button type="submit" size="lg" className="min-w-[120px]">
                    Continue
                  </Button>
                </div>
              </div>
            )}

            {currentStep === 2 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 mb-1">Consent & Authorization</h2>
                  <p className="text-sm text-gray-600">Please review and acknowledge the following</p>
                </div>

                <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-6 space-y-4">
                  <div className="flex items-start space-x-3">
                    <CheckCircle2 className="h-6 w-6 text-blue-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <h3 className="font-semibold text-blue-900 mb-2">Data Collection</h3>
                      <p className="text-sm text-blue-800">
                        By proceeding, you acknowledge that your medical information will be collected and stored securely in compliance with HIPAA regulations.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3">
                    <CheckCircle2 className="h-6 w-6 text-blue-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <h3 className="font-semibold text-blue-900 mb-2">AI Processing</h3>
                      <p className="text-sm text-blue-800">
                        AI-powered tools will be used to process your intake information and generate clinical summaries for healthcare providers.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3">
                    <CheckCircle2 className="h-6 w-6 text-blue-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <h3 className="font-semibold text-blue-900 mb-2">Information Sharing</h3>
                      <p className="text-sm text-blue-800">
                        Your information may be shared with authorized healthcare providers involved in your care, in accordance with HIPAA guidelines.
                      </p>
                    </div>
                  </div>
                </div>

                <div className={`flex items-start p-5 rounded-lg border-2 transition-colors ${errors.consent ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-gray-50'}`}>
                  <input
                    type="checkbox"
                    name="consent"
                    checked={formData.consent}
                    onChange={handleChange}
                    className="h-5 w-5 text-[#2E86AB] focus:ring-[#2E86AB] border-gray-300 rounded mt-0.5 cursor-pointer"
                    required
                  />
                  <label className="ml-3 block text-sm text-gray-700 cursor-pointer">
                    <span className="font-medium">I have read and agree to the consent terms above *</span>
                    <span className="block text-xs text-gray-500 mt-1">
                      You must agree to proceed with registration
                    </span>
                  </label>
                </div>
                {errors.consent && (
                  <p className="text-sm text-red-600 ml-8">{errors.consent}</p>
                )}

                <div className="flex gap-4 pt-6 border-t border-gray-200">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleBack}
                    size="lg"
                    className="flex-1"
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back
                  </Button>
                  <Button
                    type="submit"
                    size="lg"
                    className="flex-1"
                    isLoading={registerMutation.isPending}
                  >
                    Register Patient
                  </Button>
                </div>
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
};
