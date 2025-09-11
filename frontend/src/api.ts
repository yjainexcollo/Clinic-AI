import axios from "axios";

const API_ENDPOINT =
  "https://n8n-excollo.azurewebsites.net/webhook/intake-dynamic-doctor";

export interface IntakeRequest {
  session_id: string;
  patient_id?: string;
  last_question?: string;
  last_answer?: string;
}

export interface IntakeResponse {
  next_question: string;
  summary?: string;
  type: "text";
}

export class IntakeAPI {
  private static instance: IntakeAPI;

  public static getInstance(): IntakeAPI {
    if (!IntakeAPI.instance) {
      IntakeAPI.instance = new IntakeAPI();
    }
    return IntakeAPI.instance;
  }

  private constructor() {
    // Configure axios defaults
    axios.defaults.headers.common["Content-Type"] = "application/json";
    axios.defaults.timeout = 15000; // Increased timeout to 15 seconds
  }

  async sendIntakeData(data: IntakeRequest): Promise<IntakeResponse> {
    try {
      console.log("Sending intake data:", data);
      console.log("API Endpoint:", API_ENDPOINT);

      const response = await axios.post<IntakeResponse>(API_ENDPOINT, data, {
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        // Add CORS handling
        withCredentials: false,
      });

      console.log("Received response:", response.data);
      console.log("Response status:", response.status);

      if (response.status !== 200) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return response.data;
    } catch (error) {
      console.error("API Error details:", error);

      if (axios.isAxiosError(error)) {
        console.log("Axios error code:", error.code);
        console.log("Axios error message:", error.message);

        if (error.response) {
          // Server responded with error status
          console.log("Server error response:", error.response.data);
          console.log("Server error status:", error.response.status);
          throw new Error(
            `Server error (${error.response.status}): Please try again later`
          );
        } else if (error.request) {
          // Network error - could be CORS or connectivity issue
          console.log("Network error details:", error.request);
          if (error.code === "ERR_NETWORK") {
            throw new Error(
              "Unable to connect to the server. This might be a CORS issue or the server may be unavailable. Please try again later."
            );
          }
          throw new Error(
            "Network error - please check your connection and try again"
          );
        }
      }

      // Generic error
      throw new Error("An unexpected error occurred. Please try again.");
    }
  }

  // Add a method to test connectivity
  async testConnection(): Promise<boolean> {
    try {
      console.log("Testing connection to API endpoint...");
      const response = await fetch(API_ENDPOINT, {
        method: "HEAD",
        mode: "no-cors",
      });
      console.log("Connection test result:", response);
      return true;
    } catch (error) {
      console.log("Connection test failed:", error);
      return false;
    }
  }
}

export const intakeAPI = IntakeAPI.getInstance();
