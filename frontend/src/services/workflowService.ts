import axios from "axios";
import { API_CONFIG, buildApiUrl } from "../config/api";

const API_KEY = import.meta.env?.VITE_API_KEY as string | undefined;

export interface CreateWalkInVisitRequest {
  name: string;
  mobile: string;
  age?: number;
  gender?: string;
  language?: string;
}

export interface CreateWalkInVisitResponse {
  patient_id: string;
  visit_id: string;
  workflow_type: string;
  status: string;
  message: string;
}

export interface AvailableStepsResponse {
  visit_id: string;
  workflow_type: string;
  current_status: string;
  available_steps: string[];
}

export interface WalkInVisit {
  visit_id: string;
  patient_id: string;
  workflow_type: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface WalkInVisitsResponse {
  visits: WalkInVisit[];
  limit: number;
  offset: number;
  count: number;
}

export class WorkflowService {
  private static instance: WorkflowService;

  public static getInstance(): WorkflowService {
    if (!WorkflowService.instance) {
      WorkflowService.instance = new WorkflowService();
    }
    return WorkflowService.instance;
  }

  private constructor() {
    // Configure axios defaults
    axios.defaults.headers.common["Content-Type"] = "application/json";
    axios.defaults.timeout = 15000;

    if (!API_KEY) {
      console.warn(
        "[WorkflowService] VITE_API_KEY is not set. Workflow requests to the backend will be rejected with 401 Unauthorized."
      );
    }
  }

  private buildHeaders(
    extra: Record<string, string> = {}
  ): Record<string, string> {
    const headers: Record<string, string> = {
      Accept: "application/json",
      ...extra,
    };

    if (API_KEY) {
      headers["X-API-Key"] = API_KEY;
    }

    return headers;
  }

  /**
   * Create a walk-in visit for patients without intake
   */
  async createWalkInVisit(data: CreateWalkInVisitRequest): Promise<CreateWalkInVisitResponse> {
    try {
      console.log("Creating walk-in visit:", data);
      
      const response = await axios.post<CreateWalkInVisitResponse>(
        buildApiUrl(API_CONFIG.ENDPOINTS.CREATE_WALK_IN_VISIT),
        data,
        {
          headers: {
            ...this.buildHeaders({ "Content-Type": "application/json" }),
          },
        }
      );

      console.log("Walk-in visit created - full axios response:", response);
      console.log("Walk-in visit created - response.data:", response.data);
      console.log("Walk-in visit created - response.data type:", typeof response.data);
      console.log("Walk-in visit created - response.data keys:", response.data ? Object.keys(response.data) : 'null');
      
      // Extract data from ApiResponse wrapper
      // Backend returns: {success: true, data: {patient_id, visit_id, ...}, message: "..."}
      const apiResponse: any = response.data;
      
      if (!apiResponse || typeof apiResponse !== 'object') {
        console.error("Walk-in visit created - Invalid apiResponse:", apiResponse);
        throw new Error(`Invalid response structure: ${typeof apiResponse}`);
      }
      
      console.log("Walk-in visit created - apiResponse keys:", Object.keys(apiResponse));
      console.log("Walk-in visit created - apiResponse.data:", apiResponse.data);
      
      if ('data' in apiResponse && apiResponse.data) {
        const extractedData = apiResponse.data as CreateWalkInVisitResponse;
        console.log("Walk-in visit created - extracted data:", extractedData);
        console.log("Walk-in visit created - extracted patient_id:", extractedData.patient_id);
        console.log("Walk-in visit created - extracted visit_id:", extractedData.visit_id);
        
        // Validate extracted data
        if (!extractedData.patient_id || !extractedData.visit_id) {
          console.error("Walk-in visit created - Missing IDs in extracted data:", extractedData);
          throw new Error(`Missing patient_id or visit_id in response: ${JSON.stringify(extractedData)}`);
        }
        
        return extractedData;
      }
      
      // Fallback: if response is not wrapped, return as-is
      console.warn("Walk-in visit created - response not wrapped, returning as-is");
      console.warn("Walk-in visit created - Direct response:", apiResponse);
      
      // Even in fallback, validate required fields
      if (!apiResponse.patient_id || !apiResponse.visit_id) {
        console.error("Walk-in visit created - Missing IDs in direct response:", apiResponse);
        throw new Error(`Missing patient_id or visit_id in response: ${JSON.stringify(apiResponse)}`);
      }
      
      return apiResponse as CreateWalkInVisitResponse;
    } catch (error) {
      console.error("Error creating walk-in visit:", error);
      
      if (axios.isAxiosError(error)) {
        if (error.response) {
          throw new Error(
            `Server error (${error.response.status}): ${error.response.data?.message || error.response.statusText}`
          );
        } else if (error.request) {
          throw new Error("Network error - please check your connection and try again");
        }
      }
      
      throw new Error("An unexpected error occurred while creating walk-in visit");
    }
  }

  /**
   * Get available workflow steps for a visit
   */
  async getAvailableSteps(visitId: string): Promise<AvailableStepsResponse> {
    try {
      console.log("Getting available steps for visit:", visitId);
      
      // Build URL correctly: /workflow/visit/{visitId}/available-steps
      const url = buildApiUrl(`${API_CONFIG.ENDPOINTS.GET_AVAILABLE_STEPS}/${visitId}/available-steps`);
      console.log("Available steps URL:", url);
      
      const response = await axios.get<{data: AvailableStepsResponse} | AvailableStepsResponse>(
        url,
        {
          headers: {
            ...this.buildHeaders(),
          },
        }
      );

      console.log("Available steps - raw response:", response.data);
      
      // Extract data from ApiResponse wrapper if present
      const responseData = response.data;
      const data = (responseData as any)?.data || responseData;
      console.log("Available steps - extracted data:", data);
      
      return data as AvailableStepsResponse;
    } catch (error) {
      console.error("Error getting available steps:", error);
      
      if (axios.isAxiosError(error)) {
        if (error.response) {
          throw new Error(
            `Server error (${error.response.status}): ${error.response.data?.message || error.response.statusText}`
          );
        } else if (error.request) {
          throw new Error("Network error - please check your connection and try again");
        }
      }
      
      throw new Error("An unexpected error occurred while getting available steps");
    }
  }

  /**
   * List walk-in visits with pagination
   */
  async listWalkInVisits(limit: number = 100, offset: number = 0): Promise<WalkInVisitsResponse> {
    try {
      console.log("Listing walk-in visits:", { limit, offset });
      
      const response = await axios.get<WalkInVisitsResponse>(
        buildApiUrl(API_CONFIG.ENDPOINTS.LIST_WALK_IN_VISITS),
        {
          params: { limit, offset },
          headers: {
            ...this.buildHeaders(),
          },
        }
      );

      console.log("Walk-in visits:", response.data);
      return response.data;
    } catch (error) {
      console.error("Error listing walk-in visits:", error);
      
      if (axios.isAxiosError(error)) {
        if (error.response) {
          throw new Error(
            `Server error (${error.response.status}): ${error.response.data?.message || error.response.statusText}`
          );
        } else if (error.request) {
          throw new Error("Network error - please check your connection and try again");
        }
      }
      
      throw new Error("An unexpected error occurred while listing walk-in visits");
    }
  }

  /**
   * Generate pre-visit summary manually
   */
  async generatePreVisitSummary(patientId: string, visitId: string): Promise<any> {
    try {
      console.log("Generating pre-visit summary:", { patientId, visitId });
      
      const response = await axios.post(
        buildApiUrl(API_CONFIG.ENDPOINTS.GENERATE_PRE_VISIT_SUMMARY),
        {
          patient_id: patientId,
          visit_id: visitId,
        },
        {
          headers: {
            ...this.buildHeaders({ "Content-Type": "application/json" }),
          },
        }
      );

      console.log("Pre-visit summary generated:", response.data);
      return response.data;
    } catch (error) {
      console.error("Error generating pre-visit summary:", error);
      
      if (axios.isAxiosError(error)) {
        if (error.response) {
          throw new Error(
            `Server error (${error.response.status}): ${error.response.data?.message || error.response.statusText}`
          );
        } else if (error.request) {
          throw new Error("Network error - please check your connection and try again");
        }
      }
      
      throw new Error("An unexpected error occurred while generating pre-visit summary");
    }
  }
}

export const workflowService = WorkflowService.getInstance();
