import axios from "axios";
import { API_CONFIG, buildApiUrl } from "../config/api";

export interface CreateWalkInVisitRequest {
  name: string;
  mobile: string;
  age?: number;
  gender?: string;
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
            "Content-Type": "application/json",
            Accept: "application/json",
          },
        }
      );

      console.log("Walk-in visit created:", response.data);
      return response.data;
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
      
      const response = await axios.get<AvailableStepsResponse>(
        buildApiUrl(API_CONFIG.ENDPOINTS.GET_AVAILABLE_STEPS + `/${visitId}/available-steps`),
        {
          headers: {
            Accept: "application/json",
          },
        }
      );

      console.log("Available steps:", response.data);
      return response.data;
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
            Accept: "application/json",
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
            "Content-Type": "application/json",
            Accept: "application/json",
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
