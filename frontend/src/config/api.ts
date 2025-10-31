// API Configuration
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

export const API_CONFIG = {
  // Backend API base URL with HTTPS normalization
  BASE_URL: normalizeBaseUrl(
    import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_BACKEND_BASE_URL as string
  ) || "https://clinicai-backend-x7v3qgkqra-uc.a.run.app",
  
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
