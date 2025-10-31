const API_ENDPOINT =
  (import.meta as any).env?.VITE_N8N_WEBHOOK_URL ||
  "https://n8n-excollo.azurewebsites.net/webhook";

// Backend API base URL (FastAPI) with normalization
function normalizeBaseUrl(input?: string): string {
  let url = (input || "").trim();
  if (!url) return "https://clinicai-backend-x7v3qgkqra-uc.a.run.app";
  
  // Add protocol if missing - prefer HTTPS unless localhost
  if (!/^https?:\/\//i.test(url)) {
    // Use HTTP only for localhost, HTTPS for everything else
    const isLocalhost = url.includes('localhost') || url.includes('127.0.0.1');
    url = isLocalhost ? `http://${url}` : `https://${url}`;
  }
  
  // If HTTP is used for non-localhost, upgrade to HTTPS (fixes Mixed Content issues)
  if (url.startsWith('http://') && !url.includes('localhost') && !url.includes('127.0.0.1')) {
    url = url.replace('http://', 'https://');
  }
  
  // Map 0.0.0.0 to localhost for browser requests
  url = url.replace(/\b0\.0\.0\.0\b/g, "localhost");
  // Drop trailing slashes
  url = url.replace(/\/+$/g, "");
  return url;
}

const BACKEND_BASE_URL: string = normalizeBaseUrl(
  (import.meta as any).env?.VITE_BACKEND_BASE_URL as string
) || "https://clinicai-backend-x7v3qgkqra-uc.a.run.app";

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

// Backend answer request
export interface BackendAnswerRequest {
  patient_id: string;
  visit_id: string;
  answer: string;
}

// Backend answer response
export interface BackendAnswerResponse {
  next_question: string | null;
  is_complete: boolean;
  completion_percent?: number;
  allows_image_upload?: boolean;
  max_questions?: number;
  ocr_quality?: OCRQualityInfo;
}

// OCR Quality Info interface
export interface OCRQualityInfo {
  confidence: number;
  quality_score: number;
  needs_review: boolean;
}

// Post-visit summary interfaces
export interface PostVisitSummaryResponse {
  patient_id: string;
  visit_id: string;
  patient_name: string;
  visit_date: string;
  clinic_name: string;
  doctor_name: string;
  chief_complaint: string;
  key_findings: string[];
  diagnosis: string;
  medications: Array<{
    name: string;
    dosage: string;
    frequency: string;
    duration: string;
    purpose: string;
  }>;
  other_recommendations: string[];
  tests_ordered: Array<{
    test_name: string;
    purpose: string;
    instructions: string;
  }>;
  next_appointment?: string;
  red_flag_symptoms: string[];
  patient_instructions: string[];
  reassurance_note: string;
  clinic_contact: string;
  generated_at: string;
}

// Backend answer API
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

// Upload multiple medication images via webhook route
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

// Backend patient registration function
export async function registerPatientBackend(
  patientData: {
    first_name: string;
    last_name: string;
    mobile: string;
    age: number;
    gender: string;
    recently_travelled?: boolean;
    consent: boolean;
    country?: string;
    language?: string;
  }
): Promise<BackendRegisterResponse> {
  // Add a safety timeout so UI won't spin indefinitely
  const controller = new AbortController();
  const timeoutMs = 20000; // 20s
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(`${BACKEND_BASE_URL}/patients/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patientData),
      signal: controller.signal,
    });
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Backend error ${resp.status}: ${text}`);
    }
    return resp.json();
  } catch (e: any) {
    if (e?.name === "AbortError") {
      throw new Error("Request timed out while creating patient. Please try again.");
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
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
): Promise<{ patient_id: string; visit_id: string; summary: string; generated_at: string; medication_images?: Array<{ id: string; filename: string; content_type?: string }>; red_flags?: Array<{ type: string; question: string; answer: string; message: string }> }> {
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

// Get post-visit summary from backend
export async function getPostVisitSummary(
  patientId: string,
  visitId: string
): Promise<PostVisitSummaryResponse> {
  try {
    console.log(`Requesting post-visit summary for patient: ${patientId}, visit: ${visitId}`);
    console.log(`Backend URL: ${BACKEND_BASE_URL}/patients/summary/postvisit`);
    
    // First try to fetch stored summary
    let response = await fetch(`${BACKEND_BASE_URL}/patients/${encodeURIComponent(patientId)}/visits/${encodeURIComponent(visitId)}/summary/postvisit`, {
      method: "GET",
      headers: { Accept: "application/json" },
    });
    if (response.status === 404) {
      // Not found -> generate then fetch
      const gen = await fetch(`${BACKEND_BASE_URL}/patients/summary/postvisit`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ patient_id: patientId, visit_id: visitId }),
      });
      if (!gen.ok) {
        const t = await gen.text();
        throw new Error(`Backend error ${gen.status}: ${t}`);
      }
      response = await fetch(`${BACKEND_BASE_URL}/patients/${encodeURIComponent(patientId)}/visits/${encodeURIComponent(visitId)}/summary/postvisit`, {
        method: "GET",
        headers: { Accept: "application/json" },
      });
    }

    console.log(`Response status: ${response.status}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Backend error response:`, errorText);
      throw new Error(`Backend error ${response.status}: ${errorText}`);
    }

    const result = await response.json();
    console.log(`Post-visit summary response:`, result);
    return result;
  } catch (error) {
    console.error("Error getting post-visit summary:", error);
    throw error; // Re-throw the original error instead of a generic message
  }
}

// Generate (create) post-visit summary only
export async function generatePostVisitSummary(patientId: string, visitId: string): Promise<PostVisitSummaryResponse> {
  const gen = await fetch(`${BACKEND_BASE_URL}/patients/summary/postvisit`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ patient_id: patientId, visit_id: visitId }),
  });
  if (!gen.ok) {
    const t = await gen.text();
    throw new Error(`Backend error ${gen.status}: ${t}`);
  }
  return gen.json();
}

// Fetch stored post-visit summary only (no generation fallback)
export async function getStoredPostVisitSummary(patientId: string, visitId: string): Promise<PostVisitSummaryResponse> {
  const response = await fetch(`${BACKEND_BASE_URL}/patients/${encodeURIComponent(patientId)}/visits/${encodeURIComponent(visitId)}/summary/postvisit`, {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Backend error ${response.status}: ${text}`);
  }
  return response.json();
}

// Share post-visit summary via WhatsApp
export function sharePostVisitSummaryViaWhatsApp(summary: PostVisitSummaryResponse): void {
  const message = formatPostVisitSummaryForWhatsApp(summary);
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
  window.open(whatsappUrl, '_blank');
}

// Format post-visit summary for WhatsApp sharing
function formatPostVisitSummaryForWhatsApp(summary: PostVisitSummaryResponse): string {
  let message = `🏥 *${summary.clinic_name}*\n`;
  message += `📅 Visit Date: ${new Date(summary.visit_date).toLocaleDateString()}\n`;
  message += `👨‍⚕️ Doctor: ${summary.doctor_name}\n\n`;
  
  message += `*Chief Complaint:*\n${summary.chief_complaint}\n\n`;
  
  if (summary.key_findings.length > 0) {
    message += `*Key Findings:*\n`;
    summary.key_findings.forEach((finding, index) => {
      message += `${index + 1}. ${finding}\n`;
    });
    message += `\n`;
  }
  
  message += `*Diagnosis:*\n${summary.diagnosis}\n\n`;
  
  if (summary.medications.length > 0) {
    message += `*Medications:*\n`;
    summary.medications.forEach((med, index) => {
      message += `${index + 1}. *${med.name}*\n`;
      message += `   Dosage: ${med.dosage}\n`;
      message += `   Frequency: ${med.frequency}\n`;
      message += `   Duration: ${med.duration}\n`;
      if (med.purpose) message += `   Purpose: ${med.purpose}\n`;
      message += `\n`;
    });
  }
  
  if (summary.other_recommendations.length > 0) {
    message += `*Recommendations:*\n`;
    summary.other_recommendations.forEach((rec, index) => {
      message += `${index + 1}. ${rec}\n`;
    });
    message += `\n`;
  }
  
  if (summary.tests_ordered.length > 0) {
    message += `*Tests Ordered:*\n`;
    summary.tests_ordered.forEach((test, index) => {
      message += `${index + 1}. *${test.test_name}*\n`;
      message += `   Purpose: ${test.purpose}\n`;
      message += `   Instructions: ${test.instructions}\n\n`;
    });
  }
  
  if (summary.next_appointment) {
    message += `*Next Appointment:*\n${summary.next_appointment}\n\n`;
  }
  
  if (summary.red_flag_symptoms.length > 0) {
    message += `⚠️ *Warning Signs - Seek immediate medical attention if:*\n`;
    summary.red_flag_symptoms.forEach((symptom, index) => {
      message += `${index + 1}. ${symptom}\n`;
    });
    message += `\n`;
  }
  
  message += `*Patient Instructions:*\n`;
  summary.patient_instructions.forEach((instruction, index) => {
    message += `${index + 1}. ${instruction}\n`;
  });
  message += `\n`;
  
  message += `*${summary.reassurance_note}*\n\n`;
  message += `📞 *Contact:* ${summary.clinic_contact}`;
  
  return message;
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

// ------------------------
// Doctor Preferences API
// ------------------------
export interface DoctorPreferencesResponse {
  doctor_id: string;
  global_categories: string[];
  selected_categories: string[];
  max_questions: number;
}

export interface UpsertDoctorPreferencesRequest {
  categories: string[];
  max_questions: number;
  global_categories?: string[];
}

export async function getDoctorPreferences(): Promise<DoctorPreferencesResponse> {
  const res = await fetch(`${BACKEND_BASE_URL}/doctor/preferences`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Backend error ${res.status}: ${t}`);
  }
  return res.json();
}

export async function saveDoctorPreferences(payload: UpsertDoctorPreferencesRequest): Promise<{ success?: boolean } & Partial<DoctorPreferencesResponse>> {
  const res = await fetch(`${BACKEND_BASE_URL}/doctor/preferences`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Backend error ${res.status}: ${t}`);
  }
  return res.json();
}