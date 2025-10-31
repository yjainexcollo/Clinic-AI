/**
 * API Response utilities for handling standardized backend responses
 */

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  timestamp: string;
  request_id: string;
  data?: T;
}

export interface ErrorResponse {
  success: false;
  error: string;
  message: string;
  details?: Record<string, any>;
  timestamp: string;
  request_id: string;
}

/**
 * Extract data from ApiResponse, throwing if the response indicates failure
 */
export function extractApiResponse<T>(response: ApiResponse<T> | ErrorResponse): T {
  if (!response.success) {
    const error = response as ErrorResponse;
    throw new Error(error.message || error.error || 'API request failed');
  }
  
  if (response.data === undefined) {
    throw new Error('Response data is missing');
  }
  
  return response.data as T;
}

/**
 * Check if a response is an error response
 */
export function isErrorResponse(response: any): response is ErrorResponse {
  return response && response.success === false && 'error' in response;
}

/**
 * Parse fetch response and handle ApiResponse format
 */
export async function parseApiResponse<T>(response: Response): Promise<T> {
  const data = await response.json();
  
  if (!response.ok) {
    // Handle error responses
    if (isErrorResponse(data)) {
      throw new Error(data.message || data.error || 'API request failed');
    }
    throw new Error(data.message || `HTTP ${response.status}: ${response.statusText}`);
  }
  
  // Extract data from successful ApiResponse
  return extractApiResponse<T>(data);
}

/**
 * Handle fetch errors and parse standardized API responses
 */
export async function handleApiRequest<T>(
  request: Promise<Response>
): Promise<T> {
  try {
    const response = await request;
    return await parseApiResponse<T>(response);
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Unknown error occurred');
  }
}

