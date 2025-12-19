import axios, { AxiosError } from 'axios';
import type { AxiosInstance } from 'axios';
import { API_CONFIG } from '../config/api';

const API_BASE_URL =
  (import.meta.env?.VITE_API_URL as string) ||
  (import.meta.env?.VITE_BACKEND_BASE_URL as string) ||
  API_CONFIG.BASE_URL;
const API_KEY = import.meta.env?.VITE_API_KEY as string | undefined;

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  details?: Record<string, unknown>;
}

export interface RegisterPatientRequest {
  first_name: string;
  last_name: string;
  mobile: string;
  age: number;
  gender: string;
  recently_travelled: boolean;
  consent: boolean;
  country: string;
  language: 'en' | 'es';
}

export interface RegisterPatientResponse {
  patient_id: string;
  visit_id: string;
  first_question: string;
  message: string;
}

export interface AnswerIntakeRequest {
  patient_id: string;
  visit_id: string;
  answer: string;
  question_id?: string;
}

export interface AnswerIntakeResponse {
  patient_id?: string;
  visit_id?: string;
  next_question?: string;
  is_complete: boolean;
  question_count?: number;
  current_count?: number;
  max_questions: number;
  completion_percent?: number;
  allows_image_upload?: boolean;
  message: string;
}

export interface PreVisitSummaryResponse {
  patient_id: string;
  visit_id: string;
  summary: string;
  generated_at: string;
  medication_images?: Array<{ id: string; filename: string; content_type: string }>;
  red_flags?: Array<{ flag: string; description: string }>;
}

export interface SoapTemplate {
  template_name?: string;
  category?: string;
  speciality?: string;
  description?: string;
  soap_content?: {
    subjective?: string;
    objective?: string;
    assessment?: string;
    plan?: string;
  };
  tags?: string[];
  appointment_types?: string[];
  uploaded_at?: string;
}

export interface SoapNoteRequest {
  patient_id: string;
  visit_id: string;
  transcript?: string;
  // Optional per-visit SOAP template; when omitted, backend uses default behavior.
  template?: SoapTemplate;
}

export interface SoapNote {
  subjective: string;
  objective: {
    vital_signs: Record<string, string>;
    physical_exam: Record<string, string>;
  };
  assessment: string;
  plan: string;
  highlights: string[];
  red_flags: string[];
}

export interface SoapNoteResponse {
  patient_id: string;
  visit_id: string;
  soap_note: SoapNote;
  generated_at: string;
  message: string;
}

export interface VitalsRequest {
  patient_id: string;
  visit_id: string;
  vitals: {
    blood_pressure?: string;
    heart_rate?: number;
    temperature?: number;
    respiratory_rate?: number;
    oxygen_saturation?: number;
    weight?: number;
    height?: number;
    bmi?: number;
  };
}

export interface CreateWalkInVisitRequest {
  name: string;
  mobile: string;
  age: number;
  gender: string;
}

export interface CreateWalkInVisitResponse {
  patient_id: string;
  visit_id: string;
  workflow_type: string;
  status: string;
  message: string;
}

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    if (!API_KEY) {
      console.warn(
        '[API] VITE_API_KEY is not set. All backend requests will be rejected with 401 Unauthorized.'
      );
    }

    const defaultHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (API_KEY) {
      defaultHeaders['X-API-Key'] = API_KEY;
    }

    this.client = axios.create({
      baseURL: API_BASE_URL,
      headers: defaultHeaders,
    });

    // Add request interceptor for logging
    this.client.interceptors.request.use(
      (config) => {
        if (API_KEY) {
          config.headers = {
            ...config.headers,
            'X-API-Key': API_KEY,
          };
        }
        console.log(`[API] ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        if (error.response) {
          console.error('[API Error]', error.response.data);
        } else if (error.request) {
          console.error('[API Error]', 'No response received');
        } else {
          console.error('[API Error]', error.message);
        }
        return Promise.reject(error);
      }
    );
  }

  private async request<T>(config: any): Promise<ApiResponse<T>> {
    try {
      const response = await this.client.request<ApiResponse<T>>(config);
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        return error.response.data as ApiResponse<T>;
      }
      throw error;
    }
  }

  // Patient endpoints
  async registerPatient(data: RegisterPatientRequest): Promise<ApiResponse<RegisterPatientResponse>> {
    return this.request<RegisterPatientResponse>({
      method: 'POST',
      url: '/patients/',
      data,
    });
  }

  async answerIntake(data: AnswerIntakeRequest, files?: File[]): Promise<ApiResponse<AnswerIntakeResponse>> {
    const formData = new FormData();
    formData.append('patient_id', data.patient_id);
    formData.append('visit_id', data.visit_id);
    formData.append('answer', data.answer);
    if (data.question_id) {
      formData.append('question_id', data.question_id);
    }
    
    if (files) {
      files.forEach((file) => {
        formData.append('medication_images', file);
      });
    }

    const response = await this.client.post<ApiResponse<AnswerIntakeResponse>>(
      '/patients/consultations/answer',
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );
    return response.data;
  }

  // Visit endpoints
  async getPreVisitSummary(patientId: string, visitId: string): Promise<ApiResponse<PreVisitSummaryResponse>> {
    return this.request<PreVisitSummaryResponse>({
      method: 'GET',
      url: `/patients/${patientId}/visits/${visitId}/summary`,
    });
  }

  async generatePreVisitSummary(patientId: string, visitId: string): Promise<ApiResponse<PreVisitSummaryResponse>> {
    return this.request<PreVisitSummaryResponse>({
      method: 'POST',
      url: `/patients/summary/previsit`,
      data: { patient_id: patientId, visit_id: visitId },
    });
  }

  async getPostVisitSummary(patientId: string, visitId: string): Promise<ApiResponse<any>> {
    return this.request<any>({
      method: 'GET',
      url: `/patients/${patientId}/visits/${visitId}/summary/postvisit`,
    });
  }

  // Transcription endpoints
  async transcribeAudio(
    patientId: string,
    visitId: string,
    audioFile: File,
    language: string = 'en'
  ): Promise<ApiResponse<any>> {
    const formData = new FormData();
    formData.append('patient_id', patientId);
    formData.append('visit_id', visitId);
    formData.append('audio_file', audioFile);
    formData.append('language', language);

    const response = await this.client.post('/notes/transcribe', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  }

  // Note: getTranscript is defined later using /notes endpoint

  // SOAP endpoints
  async generateSoapNote(data: SoapNoteRequest): Promise<ApiResponse<SoapNoteResponse>> {
    return this.request<SoapNoteResponse>({
      method: 'POST',
      url: '/notes/soap/generate',
      data,
    });
  }

  async getSoapNote(patientId: string, visitId: string): Promise<ApiResponse<SoapNoteResponse>> {
    return this.request<SoapNoteResponse>({
      method: 'GET',
      url: `/patients/${patientId}/visits/${visitId}/soap`,
    });
  }

  // Vitals endpoints
  async storeVitals(data: VitalsRequest): Promise<ApiResponse<any>> {
    return this.request<any>({
      method: 'POST',
      url: '/notes/vitals',
      data,
    });
  }

  async getVitals(patientId: string, visitId: string): Promise<ApiResponse<any>> {
    return this.request<any>({
      method: 'GET',
      url: `/notes/${patientId}/visits/${visitId}/vitals`,
    });
  }

  // Workflow endpoints
  async createWalkInVisit(data: CreateWalkInVisitRequest): Promise<ApiResponse<CreateWalkInVisitResponse>> {
    return this.request<CreateWalkInVisitResponse>({
      method: 'POST',
      url: '/workflow/walk-in/create-visit',
      data,
    });
  }

  // Intake status endpoints
  async getIntakeStatus(patientId: string, visitId: string): Promise<ApiResponse<any>> {
    return this.request<any>({
      method: 'GET',
      url: `/patients/${patientId}/visits/${visitId}/intake/status`,
    });
  }

  async resetIntakeSession(patientId: string, visitId: string): Promise<ApiResponse<any>> {
    return this.request<any>({
      method: 'POST',
      url: `/patients/${patientId}/visits/${visitId}/intake/reset`,
    });
  }

  // Edit intake answer
  async editIntakeAnswer(data: {
    patient_id: string;
    visit_id: string;
    question_number: number;
    new_answer: string;
  }): Promise<ApiResponse<any>> {
    return this.request<any>({
      method: 'PATCH',
      url: '/patients/consultations/answer',
      data,
    });
  }

  // Image management
  async uploadMedicationImages(
    patientId: string,
    visitId: string,
    images: File[]
  ): Promise<ApiResponse<any>> {
    const formData = new FormData();
    formData.append('patient_id', patientId);
    formData.append('visit_id', visitId);
    images.forEach((image) => {
      formData.append('images', image);
    });

    const response = await this.client.post<ApiResponse<any>>(
      '/patients/webhook/images',
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );
    return response.data;
  }

  async listMedicationImages(patientId: string, visitId: string): Promise<ApiResponse<any>> {
    return this.request<any>({
      method: 'GET',
      url: `/patients/${patientId}/visits/${visitId}/images`,
    });
  }

  async getMedicationImageContent(
    patientId: string,
    visitId: string,
    imageId: string
  ): Promise<Blob> {
    const response = await this.client.get(
      `/patients/${patientId}/visits/${visitId}/intake-images/${imageId}/content`,
      {
        responseType: 'blob',
      }
    );
    return response.data;
  }

  async deleteMedicationImage(imageId: string): Promise<ApiResponse<any>> {
    return this.request<any>({
      method: 'DELETE',
      url: `/patients/images/${imageId}`,
    });
  }

  // Dialogue structuring
  async structureDialogue(patientId: string, visitId: string): Promise<ApiResponse<any>> {
    return this.request<any>({
      method: 'POST',
      url: `/notes/${patientId}/visits/${visitId}/dialogue/structure`,
    });
  }

  // Post-visit summary generation
  async generatePostVisitSummary(
    patientId: string,
    visitId: string
  ): Promise<ApiResponse<any>> {
    return this.request<any>({
      method: 'POST',
      url: '/patients/summary/postvisit',
      data: { patient_id: patientId, visit_id: visitId },
    });
  }

  // Get transcript (notes endpoint)
  async getTranscript(patientId: string, visitId: string): Promise<ApiResponse<any>> {
    return this.request<any>({
      method: 'GET',
      // Backend endpoint returns TranscriptionSessionDTO (transcript + structured_dialogue)
      // Route is /notes/{patient_id}/visits/{visit_id}/dialogue
      url: `/notes/${patientId}/visits/${visitId}/dialogue`,
    });
  }

  // Workflow step management
  async getAvailableWorkflowSteps(visitId: string): Promise<ApiResponse<any>> {
    return this.request<any>({
      method: 'GET',
      url: `/workflow/visit/${visitId}/available-steps`,
    });
  }

  async listWalkInVisits(params?: {
    limit?: number;
    offset?: number;
  }): Promise<ApiResponse<any>> {
    return this.request<any>({
      method: 'GET',
      url: '/workflow/visits/walk-in',
      params,
    });
  }

  // Doctor preferences
  async getDoctorPreferences(): Promise<ApiResponse<any>> {
    return this.request<any>({
      method: 'GET',
      url: '/doctor/preferences',
    });
  }

  async saveDoctorPreferences(data: {
    categories: string[];
    max_questions: number;
    global_categories?: string[];
  }): Promise<ApiResponse<any>> {
    return this.request<any>({
      method: 'POST',
      url: '/doctor/preferences',
      data,
    });
  }

  // Health check
  async healthCheck(): Promise<ApiResponse<any>> {
    return this.request<any>({
      method: 'GET',
      url: '/health',
    });
  }
}

export const apiClient = new ApiClient();

