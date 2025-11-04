import React, { useState } from "react";
import { ArrowLeft, UserPlus, Loader2, CheckCircle } from "lucide-react";
import { workflowService, CreateWalkInVisitRequest } from "../services/workflowService";
import { LanguageToggle, Language } from "./LanguageToggle";
import { useLanguage } from "../contexts/LanguageContext";

export interface WalkInPatientFormProps {
  onPatientCreated: (patientId: string, visitId: string) => void;
  onBack: () => void;
}

const WalkInPatientForm: React.FC<WalkInPatientFormProps> = ({ onPatientCreated, onBack }) => {
  const { language, setLanguage, t } = useLanguage();
  
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    mobileNumber: "",
    age: "",
    gender: "",
    country: "US",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    // Clear error and success when user starts typing
    if (error) setError("");
    if (success) setSuccess(false);
  };

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setFormData((prev) => ({ ...prev, [name]: checked }));
    // Clear error and success when user starts typing
    if (error) setError("");
    if (success) setSuccess(false);
  };

  // Country → dial code and max digits for national significant number
  const getPhoneRules = (country: string) => {
    switch (country) {
      case "US":
      case "CA":
        return { dial: "+1", maxDigits: 10, placeholder: "415 555 2671" };
      case "GB":
        return { dial: "+44", maxDigits: 10, placeholder: "7123 456 789" };
      case "IN":
        return { dial: "+91", maxDigits: 10, placeholder: "98765 43210" };
      case "AU":
        return { dial: "+61", maxDigits: 9, placeholder: "412 345 678" };
      case "DE":
        return { dial: "+49", maxDigits: 11, placeholder: "1512 3456789" };
      case "FR":
        return { dial: "+33", maxDigits: 9, placeholder: "6 12 34 56 78" };
      case "SG":
        return { dial: "+65", maxDigits: 8, placeholder: "9123 4567" };
      case "AE":
        return { dial: "+971", maxDigits: 9, placeholder: "50 123 4567" };
      default:
        return { dial: "+1", maxDigits: 10, placeholder: "415 555 2671" };
    }
  };

  const validateForm = (): boolean => {
    if (!formData.firstName.trim()) {
      setError(language === 'sp' ? "El nombre es requerido" : "First name is required");
      return false;
    }
    
    if (!formData.lastName.trim()) {
      setError(language === 'sp' ? "El apellido es requerido" : "Last name is required");
      return false;
    }
    
    if (!formData.mobileNumber.trim()) {
      setError(language === 'sp' ? "El número móvil es requerido" : "Mobile number is required");
      return false;
    }
    
    // Age validation (only if provided)
    if (formData.age) {
      const ageNumber = parseInt(formData.age);
      if (ageNumber < 0 || ageNumber > 120) {
        setError(language === 'sp' ? "La edad debe estar entre 0 y 120" : "Age must be between 0 and 120");
        return false;
      }
    }
    
    
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setLoading(true);
    setError("");
    setSuccess(false);

    try {
      // Build E.164 using selected country's dial and limited digits
      const { dial, maxDigits } = getPhoneRules(formData.country);
      const digits = (formData.mobileNumber || "").replace(/[^0-9]/g, "").slice(0, maxDigits);
      const mobileE164 = `${dial}${digits}`;
      
      const requestData: CreateWalkInVisitRequest = {
        name: `${formData.firstName.trim()} ${formData.lastName.trim()}`.trim(),
        mobile: mobileE164,
        age: formData.age ? parseInt(formData.age) : undefined,
        gender: formData.gender || undefined,
      };

      const response = await workflowService.createWalkInVisit(requestData);
      
      console.log("WalkInPatientForm - received response:", response);
      console.log("WalkInPatientForm - response type:", typeof response);
      console.log("WalkInPatientForm - response keys:", response ? Object.keys(response) : 'null');
      console.log("WalkInPatientForm - patient_id:", response?.patient_id);
      console.log("WalkInPatientForm - visit_id:", response?.visit_id);
      
      // Validate response before proceeding
      if (!response) {
        console.error("WalkInPatientForm - response is null/undefined");
        setError("Failed to create walk-in visit: No response from server");
        setLoading(false);
        return;
      }
      
      const patientId = response.patient_id;
      const visitId = response.visit_id;
      
      console.log("WalkInPatientForm - extracted IDs:", { patientId, visitId });
      
      // Validate IDs are present and not undefined/null/empty
      if (!patientId || patientId === 'undefined' || patientId === 'null' || patientId.trim() === '') {
        console.error("WalkInPatientForm - Invalid patient_id:", patientId);
        setError(`Failed to create walk-in visit: Invalid patient ID received: ${patientId}`);
        setLoading(false);
        return;
      }
      
      if (!visitId || visitId === 'undefined' || visitId === 'null' || visitId.trim() === '') {
        console.error("WalkInPatientForm - Invalid visit_id:", visitId);
        setError(`Failed to create walk-in visit: Invalid visit ID received: ${visitId}`);
        setLoading(false);
        return;
      }
      
      console.log("WalkInPatientForm - All validations passed, navigating with:", { patientId, visitId });
      
      // Show success message briefly before navigating
      setSuccess(true);
      setLoading(false);
      
      // Navigate to transcription page after a short delay
      setTimeout(() => {
        console.log("WalkInPatientForm - Calling onPatientCreated with:", { patientId, visitId });
        onPatientCreated(patientId, visitId);
      }, 1500);
      
    } catch (err) {
      console.error("Error creating walk-in visit:", err);
      const errorMessage = err instanceof Error ? err.message : "Failed to create walk-in visit";
      
      // Handle specific error cases
      if (errorMessage.includes("409") || errorMessage.includes("already exists")) {
        setError("A patient with this name and mobile number already exists. Please check the details.");
      } else if (errorMessage.includes("400") || errorMessage.includes("validation")) {
        setError("Please check your input data and try again.");
      } else if (errorMessage.includes("Network error")) {
        setError("Network error. Please check your connection and try again.");
      } else {
        setError(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-medical-primary-light to-gray-50 flex items-center justify-center p-4">
      <div className="medical-card max-w-md w-full">
        {/* Language Toggle */}
        <div className="mb-4 flex justify-end">
          <LanguageToggle
            selectedLanguage={language}
            onLanguageChange={setLanguage}
          />
        </div>
        
        {/* Walk-in banner */}
        <div className="mb-4 rounded-md border bg-green-50 p-3 text-green-800">
          <div className="text-sm">{language === 'sp' ? 'Paciente sin cita' : 'Walk-in Patient'}</div>
          <div className="font-semibold">
            {language === 'sp' ? 'Registro rápido para consulta inmediata' : 'Quick registration for immediate consultation'}
          </div>
        </div>
        
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <UserPlus className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            {language === 'sp' ? 'Registro de Paciente Sin Cita' : 'Walk-in Patient Registration'}
          </h2>
          <p className="text-gray-600 text-sm">
            {language === 'sp' ? 'Proporcione la información básica para comenzar la consulta' : 'Provide basic information to start the consultation'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* First and Last Name Fields */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {language === 'sp' ? 'Nombre *' : 'First Name *'}
              </label>
              <input
                name="firstName"
                value={formData.firstName}
                onChange={handleChange}
                placeholder={language === 'sp' ? 'Nombre' : 'First name'}
                required
                disabled={loading}
                className="medical-input"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {language === 'sp' ? 'Apellido *' : 'Last Name *'}
              </label>
              <input
                name="lastName"
                value={formData.lastName}
                onChange={handleChange}
                placeholder={language === 'sp' ? 'Apellido' : 'Last name'}
                required
                disabled={loading}
                className="medical-input"
              />
            </div>
          </div>

          {/* Country and Mobile Number */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {language === 'sp' ? 'Número Móvil *' : 'Mobile Number *'}
            </label>
            <div className="flex items-center gap-1">
              <select
                name="country"
                value={formData.country}
                onChange={handleChange}
                disabled={loading}
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
                value={formData.mobileNumber}
                onChange={(e) => {
                  const { maxDigits } = getPhoneRules(formData.country);
                  const digitsOnly = e.target.value.replace(/[^0-9]/g, "").slice(0, maxDigits);
                  setFormData((prev) => ({ ...prev, mobileNumber: digitsOnly }));
                }}
                placeholder={getPhoneRules(formData.country).placeholder}
                type="tel"
                inputMode="numeric"
                maxLength={getPhoneRules(formData.country).maxDigits}
                required
                disabled={loading}
                className="medical-input flex-1 h-10 text-sm"
                aria-describedby="phone-help"
              />
            </div>
            <p id="phone-help" className="text-xs text-gray-500 mt-1">
              {language === 'sp' 
                ? 'Ingrese su número móvil; el país predeterminado es EE.UU. Lo formatearemos a E.164 al enviar.'
                : 'Enter your mobile number; default country is US. We\'ll format it to E.164 on submit.'
              }
            </p>
          </div>

          {/* Gender and Age in a row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {language === 'sp' ? 'Género (Opcional)' : 'Gender (Optional)'}
              </label>
              <select
                name="gender"
                value={formData.gender}
                onChange={handleChange}
                disabled={loading}
                className="medical-select"
              >
                <option value="">
                  {language === 'sp' ? 'Seleccionar Género' : 'Select Gender'}
                </option>
                <option value="male">
                  {language === 'sp' ? 'Masculino' : 'Male'}
                </option>
                <option value="female">
                  {language === 'sp' ? 'Femenino' : 'Female'}
                </option>
                <option value="other">
                  {language === 'sp' ? 'Otro' : 'Other'}
                </option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {language === 'sp' ? 'Edad (Opcional)' : 'Age (Optional)'}
              </label>
              <input
                name="age"
                value={formData.age}
                onChange={handleChange}
                placeholder={language === 'sp' ? 'Edad' : 'Age'}
                type="number"
                min="0"
                max="150"
                disabled={loading}
                className="medical-input"
              />
            </div>
          </div>


          {/* Success Message */}
          {success && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-md">
              <div className="flex items-start gap-2">
                <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                <p className="text-green-700 text-sm">
                  {language === 'sp' ? '✅ ¡Visita sin cita creada exitosamente! Redirigiendo...' : '✅ Walk-in visit created successfully! Redirecting...'}
                </p>
              </div>
            </div>
          )}

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

          {/* Action Buttons */}
          <div className="flex space-x-3 pt-4">
            <button
              type="button"
              onClick={onBack}
              disabled={loading || success}
              className="medical-button-secondary flex-1 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <ArrowLeft className="h-4 w-4" />
              {language === 'sp' ? 'Atrás' : 'Back'}
            </button>
            <button
              type="submit"
              disabled={loading || success}
              className="medical-button flex-1 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
              aria-disabled={loading || success}
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  {language === 'sp' ? 'Creando...' : 'Creating...'}
                </>
              ) : success ? (
                <>
                  <CheckCircle className="h-4 w-4" />
                  {language === 'sp' ? '¡Creado!' : 'Created!'}
                </>
              ) : (
                <>
                  <UserPlus className="h-4 w-4" />
                  {language === 'sp' ? 'Crear Visita Sin Cita' : 'Create Walk-in Visit'}
                </>
              )}
            </button>
          </div>
        </form>

        <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-md">
          <h4 className="text-sm font-medium text-green-900 mb-2">
            {language === 'sp' ? '¿Qué sucede después?' : 'What happens next?'}
          </h4>
          <ul className="text-xs text-green-700 space-y-1">
            <li>• {language === 'sp' ? 'El paciente será registrado en el sistema' : 'Patient will be registered in the system'}</li>
            <li>• {language === 'sp' ? 'Se creará una visita sin cita' : 'A walk-in visit will be created'}</li>
            <li>• {language === 'sp' ? 'Procederá directamente a la transcripción de audio' : 'You\'ll proceed directly to audio transcription'}</li>
            <li>• {language === 'sp' ? 'Se omitirá el formulario de admisión' : 'Intake form will be skipped'}</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default WalkInPatientForm;
