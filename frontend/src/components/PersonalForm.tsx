import React, { useState } from "react";
import { registerPatientBackend } from "../services/patientService";

interface PersonalFormProps {
  onPatientCreated?: (patientId: string) => void;
}

interface PersonalFormData {
  firstName: string;
  lastName: string;
  mobileNumber: string;
  gender: string;
  age: string;
  travelHistory: boolean;
  consent: boolean;
  country: string;
}

const PersonalForm: React.FC<PersonalFormProps> = ({ onPatientCreated }) => {
  const [form, setForm] = useState<PersonalFormData>({
    firstName: "",
    lastName: "",
    mobileNumber: "", // store as 10 digits; we'll prepend +1 on submit
    gender: "",
    age: "",
    travelHistory: false,
    consent: false,
    country: "US",
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

  // Country → dial code and max digits for national significant number
  const getPhoneRules = (country: string) => {
    switch (country) {
      case "US":
      case "CA":
        return { dial: "+1", maxDigits: 10, placeholder: "+1 415 555 2671" };
      case "GB":
        return { dial: "+44", maxDigits: 10, placeholder: "+44 7123 456 789" };
      case "IN":
        return { dial: "+91", maxDigits: 10, placeholder: "+91 98765 43210" };
      case "AU":
        return { dial: "+61", maxDigits: 9, placeholder: "+61 412 345 678" };
      case "DE":
        return { dial: "+49", maxDigits: 11, placeholder: "+49 1512 3456789" };
      case "FR":
        return { dial: "+33", maxDigits: 9, placeholder: "+33 6 12 34 56 78" };
      case "SG":
        return { dial: "+65", maxDigits: 8, placeholder: "+65 9123 4567" };
      case "AE":
        return { dial: "+971", maxDigits: 9, placeholder: "+971 50 123 4567" };
      default:
        return { dial: "+1", maxDigits: 10, placeholder: "+1 415 555 2671" };
    }
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

      // Build E.164 using selected country's dial and limited digits
      const { dial, maxDigits } = getPhoneRules(form.country);
      const digits = (form.mobileNumber || "").replace(/[^0-9]/g, "").slice(0, maxDigits);
      const mobileE164 = `${dial}${digits}`;
      const backendResp = await registerPatientBackend({
        first_name: form.firstName.trim(),
        last_name: form.lastName.trim(),
        mobile: mobileE164,
        gender: form.gender,
        age: ageNumber,
        recently_travelled: form.travelHistory,
        country: form.country,
        consent: true,
      });

      if (backendResp.patient_id) {
        // Persist travel history flag for later use if needed
        localStorage.setItem(`travel_${backendResp.patient_id}`, JSON.stringify(form.travelHistory));
        // Persist visit id and patient name for intake
        localStorage.setItem(`visit_${backendResp.patient_id}`, backendResp.visit_id);
        localStorage.setItem(`patient_name_${backendResp.patient_id}`, `${form.firstName} ${form.lastName}`.trim());
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
    } catch (err: any) {
      // Try to surface backend validation message if available
      try {
        const res = err?.message as string;
        const m = res?.toString() || "";
        setError(m.includes("Backend error") ? m : "Failed to create patient. Please check your details and try again.");
      } catch {
        setError("Failed to create patient. Please check your details and try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-medical-primary-light to-gray-50 flex items-center justify-center p-4">
      <div className="medical-card max-w-md w-full">
        {/* Appointment banner */}
        <div className="mb-4 rounded-md border bg-blue-50 p-3 text-blue-800">
          <div className="text-sm">Your appointment</div>
          <div className="font-semibold">
            Tue, Sep 23 • 2:30 PM PT • Clinic A (123 Main St)
          </div>
        </div>
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
          {/* First and Last Name Fields */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">First Name *</label>
              <input
                name="firstName"
                value={form.firstName}
                onChange={handleChange}
                placeholder="First name"
                required
                className="medical-input"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Last Name *</label>
              <input
                name="lastName"
                value={form.lastName}
                onChange={handleChange}
                placeholder="Last name"
                required
                className="medical-input"
              />
            </div>
          </div>

          {/* Country and Mobile Number */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Mobile Number *
            </label>
            <div className="flex items-center gap-1">
              <select
                name="country"
                value={form.country}
                onChange={handleChange}
                className="medical-select w-28 text-sm"
              >
                <option value="US">🇺🇸 +1 US</option>
                <option value="CA">🇨🇦 +1 CA</option>
                <option value="GB">🇬🇧 +44 UK</option>
                <option value="IN">🇮🇳 +91 IN</option>
                <option value="AU">🇦🇺 +61 AU</option>
                <option value="DE">🇩🇪 +49 DE</option>
                <option value="FR">🇫🇷 +33 FR</option>
                <option value="SG">🇸🇬 +65 SG</option>
                <option value="AE">🇦🇪 +971 AE</option>
              </select>
              <input
                name="mobileNumber"
                value={form.mobileNumber}
                onChange={(e) => {
                  const { maxDigits } = getPhoneRules(form.country);
                  const digitsOnly = e.target.value.replace(/[^0-9]/g, "").slice(0, maxDigits);
                  setForm((prev) => ({ ...prev, mobileNumber: digitsOnly }));
                }}
                placeholder={getPhoneRules(form.country).placeholder}
                type="tel"
                inputMode="numeric"
                maxLength={getPhoneRules(form.country).maxDigits}
                required
                className="medical-input flex-1 h-10 text-sm"
                aria-describedby="phone-help"
              />
            </div>
            <p id="phone-help" className="text-xs text-gray-500 mt-1">
              Enter your mobile number; default country is US. We’ll format it to E.164 on submit.
            </p>
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
