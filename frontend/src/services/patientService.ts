// Backend API base URL (FastAPI) with normalization
function normalizeBaseUrl(input?: string): string {
  let url = (input || "").trim();
  if (!url) return "https://clinicai-backend-x7v3qgkqra-uc.a.run.app";

  // Map 0.0.0.0 to localhost for browser requests
  url = url.replace(/\b0\.0\.0\.0\b/g, "localhost");

  // Check if it's localhost or 127.0.0.1
  const isLocalhost = url.includes('localhost') || url.includes('127.0.0.1');

  // Add protocol if missing
  if (!/^https?:\/\//i.test(url)) {
    // Use HTTP only for localhost, HTTPS for everything else
    url = isLocalhost ? `http://${url}` : `https://${url}`;
  } else {
    // Protocol is already present - ensure localhost uses HTTP (not HTTPS)
    if (isLocalhost && url.startsWith('https://')) {
      url = url.replace('https://', 'http://');
    }
    // If HTTP is used for non-localhost, upgrade to HTTPS (fixes Mixed Content issues)
    if (url.startsWith('http://') && !isLocalhost) {
      url = url.replace('http://', 'https://');
    }
  }

  // Drop trailing slashes
  url = url.replace(/\/+$/g, "");
  return url;
}

// Get the raw environment variable and normalize it
const rawBackendUrl = (import.meta as any).env?.VITE_BACKEND_BASE_URL as string;
const BACKEND_BASE_URL: string = rawBackendUrl
  ? normalizeBaseUrl(rawBackendUrl)
  : normalizeBaseUrl(""); // Will use default production URL

const API_KEY = (import.meta as any).env?.VITE_API_KEY as string | undefined;

if (!API_KEY) {
  console.warn(
    "[PatientService] VITE_API_KEY is not set. Backend requests will be rejected with 401 Unauthorized."
  );
}

function addAuthHeader(headers?: HeadersInit): HeadersInit {
  if (!API_KEY) {
    return headers ?? {};
  }

  if (!headers) {
    return { 'X-API-Key': API_KEY };
  }

  if (headers instanceof Headers) {
    headers.set('X-API-Key', API_KEY);
    return headers;
  }

  if (Array.isArray(headers)) {
    const filtered = headers.filter(([key]) => key.toLowerCase() !== 'x-api-key');
    return [...filtered, ['X-API-Key', API_KEY]];
  }

  return { ...headers, 'X-API-Key': API_KEY };
}

export function authorizedFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const headers = addAuthHeader(init.headers);
  return fetch(input, { ...init, headers });
}

export { BACKEND_BASE_URL };

// NOTE: PatientData and PatientResponse interfaces kept for backward compatibility
// but createPatient() function using n8n has been removed.
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
    resp = await authorizedFetch(`${BACKEND_BASE_URL}/patients/consultations/answer`, {
      method: "POST",
      body: form,
    });
  } else {
    resp = await authorizedFetch(`${BACKEND_BASE_URL}/patients/consultations/answer`, {
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
): Promise<{ uploaded_images: Array<{ id: string; filename: string; content_type?: string }>; status: string }> {
  const form = new FormData();
  files.forEach((f) => form.append("images", f));
  form.append("patient_id", patientId);
  form.append("visit_id", visitId);
  const resp = await authorizedFetch(`${BACKEND_BASE_URL}/patients/webhook/images`, {
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
  const resp = await authorizedFetch(`${BACKEND_BASE_URL}/patients/consultations/answer`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const json = await resp.json();

  console.log(`[editAnswerBackend] Response status: ${resp.status}, Response:`, json);

  if (!resp.ok) {
    const errorMsg = json.message || json.error || `Backend error ${resp.status}`;
    throw new Error(`Backend error ${resp.status}: ${errorMsg}`);
  }

  // Extract data from ApiResponse wrapper
  // Backend returns: {success: true, data: {success, message, next_question, ...}, ...}
  if (json && typeof json === 'object' && 'data' in json && json.data) {
    console.log(`[editAnswerBackend] Extracted data:`, json.data);
    return json.data as BackendEditAnswerResponse;
  }

  // Fallback: if response is not wrapped, return as-is (for backward compatibility)
  console.log(`[editAnswerBackend] Response not wrapped, returning as-is:`, json);
  return json as BackendEditAnswerResponse;
}

// NOTE: generatePatientId function removed - patient IDs are now generated by the backend

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
    const resp = await authorizedFetch(`${BACKEND_BASE_URL}/patients/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patientData),
      signal: controller.signal,
    });

    const json = await resp.json();

    console.log(`[registerPatientBackend] Response status: ${resp.status}, Response:`, json);

    if (!resp.ok) {
      // Handle error response
      const errorMsg = json.message || json.error || `Backend error ${resp.status}`;
      throw new Error(`Backend error ${resp.status}: ${errorMsg}`);
    }

    // Extract data from ApiResponse wrapper
    // Backend returns: {success: true, data: {patient_id, visit_id, first_question, message}, ...}
    if (json && typeof json === 'object' && 'data' in json && json.data) {
      console.log(`[registerPatientBackend] Extracted data:`, json.data);
      return json.data as BackendRegisterResponse;
    }

    // Fallback: if response is not wrapped, return as-is (for backward compatibility)
    console.log(`[registerPatientBackend] Response not wrapped, returning as-is:`, json);
    return json as BackendRegisterResponse;
  } catch (e: any) {
    if (e?.name === "AbortError") {
      throw new Error("Request timed out while creating patient. Please try again.");
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

// NOTE: createPatient has been removed - use registerPatientBackend instead
// This function was using n8n webhook which is no longer supported.

// NOTE: updatePatientSummary has been removed - this was using n8n webhook which is no longer supported.
// Patient summaries are now handled directly by the backend FastAPI service.

// NOTE: getPatient has been removed - this was using n8n webhook which is no longer supported.
// Use the backend FastAPI endpoints instead if patient data retrieval is needed.

// Get pre-visit summary from backend
export async function getPreVisitSummary(
  patientId: string,
  visitId: string
): Promise<{ patient_id: string; visit_id: string; summary: string; generated_at: string; medication_images?: Array<{ id: string; filename: string; content_type?: string }>; red_flags?: Array<{ type: string; question: string; answer: string; message: string }> }> {
  try {
    const response = await authorizedFetch(`${BACKEND_BASE_URL}/patients/${patientId}/visits/${visitId}/summary`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Backend error ${response.status}: ${response.statusText}`);
    }

    const responseData = await response.json();
    // Extract data from ApiResponse wrapper if present, otherwise use response directly
    const data = responseData.data || responseData;
    console.log('Pre-visit summary response:', {
      hasMedicationImages: !!data.medication_images,
      medicationImagesCount: data.medication_images?.length || 0,
      medicationImages: data.medication_images
    });
    return data;
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
    let response = await authorizedFetch(`${BACKEND_BASE_URL}/patients/${encodeURIComponent(patientId)}/visits/${encodeURIComponent(visitId)}/summary/postvisit`, {
      method: "GET",
      headers: { Accept: "application/json" },
    });
    if (response.status === 404) {
      // Not found -> generate then fetch
      const gen = await authorizedFetch(`${BACKEND_BASE_URL}/patients/summary/postvisit`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ patient_id: patientId, visit_id: visitId }),
      });
      if (!gen.ok) {
        const t = await gen.text();
        throw new Error(`Backend error ${gen.status}: ${t}`);
      }
      response = await authorizedFetch(`${BACKEND_BASE_URL}/patients/${encodeURIComponent(patientId)}/visits/${encodeURIComponent(visitId)}/summary/postvisit`, {
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

    const responseData = await response.json();
    // Extract data from ApiResponse wrapper if present, otherwise use response directly
    const data = responseData.data || responseData;
    console.log(`Post-visit summary response:`, { responseData, extractedData: data });
    return data;
  } catch (error) {
    console.error("Error getting post-visit summary:", error);
    throw error; // Re-throw the original error instead of a generic message
  }
}

// Generate (create) post-visit summary only
export async function generatePostVisitSummary(patientId: string, visitId: string): Promise<PostVisitSummaryResponse> {
  const gen = await authorizedFetch(`${BACKEND_BASE_URL}/patients/summary/postvisit`, {
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
  const response = await authorizedFetch(`${BACKEND_BASE_URL}/patients/${encodeURIComponent(patientId)}/visits/${encodeURIComponent(visitId)}/summary/postvisit`, {
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
  const res = await authorizedFetch(`${BACKEND_BASE_URL}/notes/soap/generate`, {
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
  const res = await authorizedFetch(
    `${BACKEND_BASE_URL}/notes/${encodeURIComponent(patientId)}/visits/${encodeURIComponent(visitId)}/soap`,
    { headers: { Accept: "application/json" } }
  );
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Backend error ${res.status}: ${t}`);
  }
  const responseData = await res.json();
  // Extract data from ApiResponse wrapper if present, otherwise use response directly
  const data = responseData.data || responseData;
  console.log('SOAP note response:', { hasData: !!data, keys: data ? Object.keys(data) : [] });
  return data;
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
  const res = await authorizedFetch(`${BACKEND_BASE_URL}/notes/vitals`, {
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
  const res = await authorizedFetch(
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
export interface PreVisitSectionConfig {
  section_key: string;
  enabled: boolean;
  selected_fields: string[];
}

export interface DoctorPreferencesResponse {
  doctor_id: string;
  soap_order: string[];
  pre_visit_config: PreVisitSectionConfig[];
}

export interface UpsertDoctorPreferencesRequest {
  soap_order?: string[];
  pre_visit_config?: PreVisitSectionConfig[];
}

export async function getDoctorPreferences(): Promise<DoctorPreferencesResponse> {
  const res = await authorizedFetch(`${BACKEND_BASE_URL}/doctor/preferences`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Backend error ${res.status}: ${t}`);
  }
  return res.json();
}

export async function saveDoctorPreferences(payload: UpsertDoctorPreferencesRequest): Promise<{ success?: boolean } & Partial<DoctorPreferencesResponse>> {
  const res = await authorizedFetch(`${BACKEND_BASE_URL}/doctor/preferences`, {
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