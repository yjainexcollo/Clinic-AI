import React, { useState } from "react";
import { registerPatientBackend } from "../services/patientService.ts";

interface PersonalFormProps {
  onPatientCreated?: (patientId: string) => void;
}

interface PersonalFormData {
  name: string;
  mobileNumber: string;
  gender: string;
  age: string;
  travelHistory: boolean;
  consent: boolean;
}

const PersonalForm: React.FC<PersonalFormProps> = ({ onPatientCreated }) => {
  const [form, setForm] = useState<PersonalFormData>({
    name: "",
    mobileNumber: "",
    gender: "",
    age: "",
    travelHistory: false,
    consent: false,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setForm((prev) => ({ ...prev, [name]: checked }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      // Convert age to number for proper data type
      const ageNumber = form.age ? Number(form.age) : 0;
      
      // Backend payload with required fields
      if (!form.consent) {
        setError("Consent is required to proceed.");
        setLoading(false);
        return;
      }

      const backendResp = await registerPatientBackend({
        name: form.name,
        mobile: form.mobileNumber,
        gender: form.gender,
        age: ageNumber,
        recently_travelled: form.travelHistory,
        consent: true,
      });

      if (backendResp.patient_id) {
        // Persist travel history flag for later use if needed
        localStorage.setItem(`travel_${backendResp.patient_id}`, JSON.stringify(form.travelHistory));
        // Persist visit id and patient name for intake
        localStorage.setItem(`visit_${backendResp.patient_id}`, backendResp.visit_id);
        localStorage.setItem(`patient_name_${backendResp.patient_id}`, form.name);
        // Seed predefined symptoms as first question options for intake page
        const predefined = [
          "Fever",
          "Cough / Cold",
          "Headache",
          "Stomach Pain",
          "Chest Pain",
          "Breathing Difficulty",
          "Fatigue / Weakness",
          "Body Pain / Joint Pain",
          "Skin Rash / Itching"
        ];
        localStorage.setItem(`symptoms_${backendResp.patient_id}`, JSON.stringify(predefined));

        // Redirect including first question so it shows immediately
        const q = encodeURIComponent(backendResp.first_question || "Why have you come in today? What is the main concern you want help with?");
        const v = encodeURIComponent(backendResp.visit_id);
        window.location.href = `/intake/${backendResp.patient_id}?q=${q}&v=${v}`;
      } else {
        setError("Failed to create patient");
      }
    } catch (err) {
      setError("Failed to create patient. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-medical-primary-light to-gray-50 flex items-center justify-center p-4">
      <div className="medical-card max-w-md w-full">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-medical-primary rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
              />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Personal Information
          </h2>
          <p className="text-gray-600 text-sm">
            Please provide your basic information to get started
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name Field */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Name *
            </label>
            <input
              name="name"
              value={form.name}
              onChange={handleChange}
              placeholder="Enter your full name"
              required
              className="medical-input"
            />
          </div>

          {/* Mobile Number Field */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Mobile Number *
            </label>
            <input
              name="mobileNumber"
              value={form.mobileNumber}
              onChange={handleChange}
              placeholder="Enter your mobile number"
              type="tel"
              required
              className="medical-input"
            />
          </div>

          {/* Gender and Age in a row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Gender *
              </label>
              <select
                name="gender"
                value={form.gender}
                onChange={handleChange}
                required
                className="medical-select"
              >
                <option value="">Select Gender</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Age *
              </label>
              <input
                name="age"
                value={form.age}
                onChange={handleChange}
                placeholder="Age"
                type="number"
                min="0"
                max="150"
                required
                className="medical-input"
              />
            </div>
          </div>

          {/* Travel History Checkbox */}
          <div className="flex items-center gap-3">
            <input
              id="travelHistory"
              name="travelHistory"
              type="checkbox"
              checked={form.travelHistory}
              onChange={handleCheckboxChange}
              className="h-4 w-4 rounded border-gray-300 text-medical-primary focus:ring-medical-primary"
            />
            <label htmlFor="travelHistory" className="text-sm text-gray-700">
              I have travelled recently (last 30 days)
            </label>
          </div>

          {/* Consent Checkbox */}
          <div className="flex items-center gap-3">
            <input
              id="consent"
              name="consent"
              type="checkbox"
              checked={form.consent}
              onChange={handleCheckboxChange}
              className="h-4 w-4 rounded border-gray-300 text-medical-primary focus:ring-medical-primary"
              required
            />
            <label htmlFor="consent" className="text-sm text-gray-700">
              I consent to processing my data for clinical intake
            </label>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading || !form.consent}
            className="medical-button w-full flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
            aria-disabled={loading || !form.consent}
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Creating Patient...
              </>
            ) : (
              <>
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 7l5 5m0 0l-5 5m5-5H6"
                  />
                </svg>
                Continue to Intake
              </>
            )}
          </button>

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md">
              <div className="flex items-start gap-2">
                <svg
                  className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <p className="text-red-700 text-sm">{error}</p>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};

export default PersonalForm;
