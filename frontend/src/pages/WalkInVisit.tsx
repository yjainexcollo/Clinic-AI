import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { apiClient } from '../lib/api';
import type { CreateWalkInVisitRequest } from '../lib/api';
import { useAppStore } from '../lib/store';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Clock, ArrowLeft } from 'lucide-react';

export const WalkInVisit: React.FC = () => {
  const navigate = useNavigate();
  const { setCurrentPatient, setCurrentVisit } = useAppStore();
  
  const [formData, setFormData] = useState<CreateWalkInVisitRequest>({
    name: '',
    mobile: '',
    age: 0,
    gender: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const createVisitMutation = useMutation({
    mutationFn: (data: CreateWalkInVisitRequest) => apiClient.createWalkInVisit(data),
    onSuccess: (response) => {
      if (response.success && response.data) {
        setCurrentPatient({
          patient_id: response.data.patient_id,
          name: formData.name,
          age: formData.age,
          gender: formData.gender,
          mobile: formData.mobile,
        });

        setCurrentVisit({
          visit_id: response.data.visit_id,
          patient_id: response.data.patient_id,
          status: response.data.status,
          workflow_type: 'WALK_IN',
        });

        toast.success('Walk-in visit created successfully!');
        navigate('/transcription', {
          state: {
            patient_id: response.data.patient_id,
            visit_id: response.data.visit_id,
          },
        });
      } else {
        toast.error(response.error || 'Failed to create walk-in visit');
      }
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to create walk-in visit. Please try again.');
    },
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    if (errors[name]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }
    if (!formData.mobile.trim()) {
      newErrors.mobile = 'Mobile number is required';
    }
    if (formData.age < 0 || formData.age > 120) {
      newErrors.age = 'Age must be between 0 and 120';
    }
    if (!formData.gender) {
      newErrors.gender = 'Gender is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      return;
    }

    createVisitMutation.mutate(formData);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-medical-primary-light to-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <button
            onClick={() => navigate('/')}
            className="flex items-center text-gray-600 hover:text-gray-900 transition-colors mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </button>
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-medical-primary rounded-xl flex items-center justify-center shadow-md">
              <Clock className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Create Walk-In Visit</h1>
              <p className="text-gray-600">Quick visit setup for urgent consultations</p>
            </div>
          </div>
        </div>

        <div className="medical-card">
          <form onSubmit={handleSubmit} className="space-y-6">
            <Input
              label="Patient Name *"
              name="name"
              value={formData.name}
              onChange={handleChange}
              error={errors.name}
              placeholder="Enter full name"
              required
            />

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

            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Age *"
                name="age"
                type="number"
                min="0"
                max="120"
                value={formData.age}
                onChange={handleChange}
                error={errors.age}
                required
              />
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Gender *
                </label>
                <select
                  name="gender"
                  value={formData.gender}
                  onChange={handleChange}
                  className="medical-select"
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

            <div className="flex gap-4 pt-6 border-t border-gray-200">
              <Button
                type="submit"
                className="flex-1"
                isLoading={createVisitMutation.isPending}
                size="lg"
              >
                Create Visit & Continue
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/')}
                size="lg"
              >
                Cancel
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
