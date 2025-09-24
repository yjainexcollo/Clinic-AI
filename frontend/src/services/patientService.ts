const API_ENDPOINT =
  (import.meta as any).env?.VITE_N8N_WEBHOOK_URL ||
  "https://n8n-excollo.azurewebsites.net/webhook";

// Backend API base URL (FastAPI) with normalization
function normalizeBaseUrl(input?: string): string {
  let url = (input || "").trim();
  if (!url) return "http://localhost:8000";
  // Add protocol if missing
  if (!/^https?:\/\//i.test(url)) {
    url = `http://${url}`;
  }
  // Map 0.0.0.0 to localhost for browser requests
  url = url.replace(/\b0\.0\.0\.0\b/g, "localhost");
  // Drop trailing slashes
  url = url.replace(/\/+$/g, "");
  return url;
}

const BACKEND_BASE_URL: string = normalizeBaseUrl(
  (import.meta as any).env?.VITE_BACKEND_BASE_URL as string
) || "http://localhost:8000";

export { BACKEND_BASE_URL };

export interface PatientData {
  fullName: string;
  age: number;
  dob: string;
  gender: string;
  email: string;
  phone?: string;
  address?: string;
  emergencyContact?: string;
}

export interface PatientResponse {
  patient_id: string;
  success: boolean;
  message?: string;
}

// Backend register response
export interface BackendRegisterResponse {
  patient_id: string;
  visit_id: string;
  first_question: string;
  message: string;
}

export interface BackendAnswerRequest {
  patient_id: string;
  visit_id: string;
  answer: string;
}

export interface OCRQualityInfo {
  quality: 'excellent' | 'good' | 'poor' | 'failed';
  confidence: number;
  extracted_text: string;
  extracted_medications: string[];
  suggestions: string[];
  word_count: number;
  has_medication_keywords: boolean;
}

export interface BackendAnswerResponse {
  next_question: string | null;
  is_complete: boolean;
  question_count: number;
  max_questions: number;
  completion_percent: number;
  message: string;
  allows_image_upload?: boolean;
  ocr_quality?: OCRQualityInfo | null;
}

// Register patient against backend FastAPI
export async function registerPatientBackend(payload: {
  first_name: string;
  last_name: string;
  mobile: string;
  gender: string;
  age: number;
  recently_travelled: boolean;
  consent: boolean;
  country?: string;
}): Promise<BackendRegisterResponse> {
  const resp = await fetch(`${BACKEND_BASE_URL}/patients/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Backend error ${resp.status}: ${text}`);
  }
  return resp.json();
}

// Answer intake question via backend
export async function answerIntakeBackend(
  payload: BackendAnswerRequest,
  imageFile?: File,
  imageFiles?: File[]
): Promise<BackendAnswerResponse> {
  let resp: Response;
  const files: File[] | undefined = imageFiles && imageFiles.length ? imageFiles : (imageFile ? [imageFile] : undefined);
  if (files && files.length) {
    const form = new FormData();
    form.append("patient_id", payload.patient_id);
    form.append("visit_id", payload.visit_id);
    form.append("answer", payload.answer);
    files.forEach((f) => form.append("medication_images", f));
    resp = await fetch(`${BACKEND_BASE_URL}/patients/consultations/answer`, {
      method: "POST",
      body: form,
    });
  } else {
    resp = await fetch(`${BACKEND_BASE_URL}/patients/consultations/answer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  }
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Backend error ${resp.status}: ${text}`);
  }
  return resp.json();
}

export interface BackendEditAnswerResponse {
  success: boolean;
  message: string;
  next_question?: string | null;
  question_count?: number | null;
  max_questions?: number | null;
  completion_percent?: number | null;
  allows_image_upload?: boolean | null;
}

export async function editAnswerBackend(payload: {
  patient_id: string;
  visit_id: string;
  question_number: number;
  new_answer: string;
}): Promise<BackendEditAnswerResponse> {
  const resp = await fetch(`${BACKEND_BASE_URL}/patients/consultations/answer`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Backend error ${resp.status}: ${text}`);
  }
  return resp.json();
}

// Function to generate patient ID on frontend
function generatePatientId(): string {
  const counterKey = "patient_counter";
  const currentCounter = localStorage.getItem(counterKey);
  const nextCounter = currentCounter ? parseInt(currentCounter) + 1 : 1;

  // Store the updated counter
  localStorage.setItem(counterKey, nextCounter.toString());

  // Generate patient ID in format CLINIC01-0001, CLINIC01-0002, etc.
  return `CLINIC01-${String(nextCounter).padStart(4, "0")}`;
}

export async function createPatient(
  patientData: PatientData
): Promise<PatientResponse> {
  try {
    // Generate patient ID on frontend
    const patient_id = generatePatientId();

    // Prepare the payload for n8n webhook with patient_id included
    const payload = {
      patient_id: patient_id,
      ...patientData,
      summary: "", 
      soapSummary:"",
      patientRecapSummary:"",
      doctorRecapSummary:"",
      diagnosis_summary: "...",
      prescription_summary: "...",
      EHR_summary:"",
      status: "incomplete", // Track patient status
      createdAt: new Date().toISOString(),
    };

    console.log("Sending patient data to n8n:", payload);

    const response = await fetch(`${API_ENDPOINT}/api/patient`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    console.log("Received response from n8n:", result);

    // Return the patient_id that was generated on frontend
    return {
      patient_id: patient_id,
      success: true,
      message: "Patient created successfully",
    };
  } catch (error) {
    console.error("Error creating patient:", error);
    throw new Error("Failed to create patient. Please try again.");
  }
}

// Function to update patient summary when intake is complete
export async function updatePatientSummary(
  patientId: string,
  summary: string
): Promise<PatientResponse> {
  try {
    const payload = {
      patient_id: patientId,
      summary: summary,
      status: "complete",
      updatedAt: new Date().toISOString(),
    };

    console.log("Updating patient summary:", payload);

    const response = await fetch(`${API_ENDPOINT}/api-patient-update`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    console.log("Received update response from n8n:", result);

    return result;
  } catch (error) {
    console.error("Error updating patient summary:", error);
    throw new Error("Failed to update patient summary. Please try again.");
  }
}

// Function to get patient details by patient_id
export async function getPatient(
  patientId: string
): Promise<PatientData & { patient_id: string }> {
  try {
    const response = await fetch(`${API_ENDPOINT}/api-patient-get`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ patient_id: patientId }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    console.log("Received patient data from n8n:", result);

    return result;
  } catch (error) {
    console.error("Error getting patient:", error);
    throw new Error("Failed to get patient details. Please try again.");
  }
}

// Get pre-visit summary from backend
export async function getPreVisitSummary(
  patientId: string,
  visitId: string
): Promise<{ patient_id: string; visit_id: string; summary: string; generated_at: string }> {
  try {
    const response = await fetch(`${BACKEND_BASE_URL}/patients/${patientId}/visits/${visitId}/summary`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Backend error ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Error getting pre-visit summary:", error);
    throw new Error("Failed to get pre-visit summary. Please try again.");
  }
}

// ------------------------
// Medication Images API
// ------------------------
export async function uploadMedicationImages(
  patientId: string,
  visitId: string,
  files: File[]
): Promise<{ uploaded_images: Array<{ id: string; filename: string; content_type?: string }>; status: string }>{
  const form = new FormData();
  files.forEach((f) => form.append("images", f));
  form.append("patient_id", patientId);
  form.append("visit_id", visitId);
  const resp = await fetch(`${BACKEND_BASE_URL}/patients/webhook/images`, {
    method: "POST",
    body: form,
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Backend error ${resp.status}: ${text}`);
  }
  return resp.json();
}

// ------------------------
// SOAP note API
// ------------------------
export interface SoapNoteResponse {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  highlights?: string[];
  red_flags?: string[];
  generated_at?: string;
  model_info?: Record<string, any> | null;
  confidence_score?: number | null;
}

export async function generateSoapNote(patientId: string, visitId: string): Promise<{ message: string } | any> {
  const res = await fetch(`${BACKEND_BASE_URL}/notes/soap/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ patient_id: patientId, visit_id: visitId }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Backend error ${res.status}: ${t}`);
  }
  return res.json();
}

export async function getSoapNote(patientId: string, visitId: string): Promise<SoapNoteResponse> {
  const res = await fetch(
    `${BACKEND_BASE_URL}/notes/${encodeURIComponent(patientId)}/visits/${encodeURIComponent(visitId)}/soap`,
    { headers: { Accept: "application/json" } }
  );
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Backend error ${res.status}: ${t}`);
  }
  return res.json();
}

// ------------------------
// Vitals API
// ------------------------
export interface VitalsData {
  systolic: string;
  diastolic: string;
  bpArm: string;
  bpPosition: string;
  heartRate: string;
  rhythm: string;
  respiratoryRate: string;
  temperature: string;
  tempUnit: string;
  tempMethod: string;
  oxygenSaturation: string;
  height: string;
  heightUnit: string;
  weight: string;
  weightUnit: string;
  painScore: string;
  notes: string;
}

export interface VitalsRequest {
  patient_id: string;
  visit_id: string;
  vitals: VitalsData;
}

export interface VitalsResponse {
  success: boolean;
  message: string;
  vitals_id: string;
}

export async function storeVitals(patientId: string, visitId: string, vitals: VitalsData): Promise<VitalsResponse> {
  const res = await fetch(`${BACKEND_BASE_URL}/notes/vitals`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      patient_id: patientId,
      visit_id: visitId,
      vitals: vitals,
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Backend error ${res.status}: ${t}`);
  }
  return res.json();
}

export async function getVitals(patientId: string, visitId: string): Promise<VitalsData> {
  const res = await fetch(
    `${BACKEND_BASE_URL}/notes/${encodeURIComponent(patientId)}/visits/${encodeURIComponent(visitId)}/vitals`,
    { headers: { Accept: "application/json" } }
  );
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Backend error ${res.status}: ${t}`);
  }
  return res.json();
}