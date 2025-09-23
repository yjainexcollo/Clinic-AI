import axios from "axios";

const api = axios.create({
  baseURL:
    (import.meta as any).env?.VITE_N8N_WEBHOOK_URL ||
    "https://n8n-excollo.azurewebsites.net/webhook/intake-dynamic-doctor",
  timeout: 15000,
  headers: {
    "Content-Type": "application/json",
  },
});

// TODO: Ensure this domain is whitelisted in n8n for CORS.

export interface IntakeResponse {
  next_question: string;
  summary: string | null;
  type: string;
}

export async function postIntake(
  payload: Record<string, any>
): Promise<IntakeResponse> {
  const { data } = await api.post<IntakeResponse>("", payload);
  return data;
} 