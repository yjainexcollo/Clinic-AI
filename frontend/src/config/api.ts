// API Configuration
export const API_CONFIG = {
  // Backend API base URL
  BASE_URL: import.meta.env.VITE_API_BASE_URL || "http://localhost:8000",
  
  // API Endpoints
  ENDPOINTS: {
    // Workflow endpoints
    CREATE_WALK_IN_VISIT: "/workflow/walk-in/create-visit",
    GET_AVAILABLE_STEPS: "/workflow/visit",
    LIST_WALK_IN_VISITS: "/workflow/visits/walk-in",
    
    // Patient endpoints
    CREATE_PATIENT: "/patients/",
    GENERATE_PRE_VISIT_SUMMARY: "/patients/summary/previsit",
    GET_PRE_VISIT_SUMMARY: "/patients",
    
    // Notes endpoints
    GET_TRANSCRIPT: "/notes",
    
    // Transcription endpoints
    TRANSCRIBE_AUDIO: "/notes/transcribe",
    GENERATE_SOAP: "/notes/soap/generate",
    
    // Other endpoints
    UPLOAD_IMAGES: "/patients/webhook/images",
    GET_IMAGES: "/patients",
    DELETE_IMAGE: "/patients/images",
  }
};

// Helper function to build full API URLs
export const buildApiUrl = (endpoint: string, params?: Record<string, string>): string => {
  let url = `${API_CONFIG.BASE_URL}${endpoint}`;
  
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      url = url.replace(`{${key}}`, value);
    });
  }
  
  return url;
};
