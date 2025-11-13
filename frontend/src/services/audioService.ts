/**
 * Audio service for managing audio files
 */

import { extractApiResponse, ApiResponse, isErrorResponse } from '../utils/apiResponse';
import { BACKEND_BASE_URL, authorizedFetch } from './patientService';

export interface AudioFile {
  audio_id: string;
  filename: string;
  content_type: string;
  file_size: number;
  duration_seconds?: number;
  patient_id?: string;
  visit_id?: string;
  adhoc_id?: string;
  audio_type: string;
  created_at: string;
  updated_at: string;
}

export interface AudioListResponse {
  files: AudioFile[];
  total_count: number;
  limit: number;
  offset: number;
}

export interface AudioStats {
  total_files: number;
  adhoc_files: number;
  visit_files: number;
  other_files: number;
}

export interface AudioDialogue {
  audio_id: string;
  filename: string;
  duration_seconds?: number;
  patient_id?: string;
  visit_id?: string;
  adhoc_id?: string;
  audio_type: string;
  created_at: string;
  structured_dialogue?: Array<{ [key: string]: string }>;
}

export interface AudioDialogueListResponse {
  dialogues: AudioDialogue[];
  total_count: number;
  limit: number;
  offset: number;
}

// Use the same BACKEND_BASE_URL as other services to ensure consistency
// This ensures HTTPS is used for production and HTTP for localhost
const API_BASE_URL = BACKEND_BASE_URL;

class AudioService {
  private cache = new Map<string, { data: any; timestamp: number }>();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  private getCachedData<T>(key: string): T | null {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return cached.data as T;
    }
    this.cache.delete(key);
    return null;
  }

  private setCachedData<T>(key: string, data: T): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  private clearCache(): void {
    this.cache.clear();
  }
  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;
    
    // Add timeout controller
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
    try {
      const response = await authorizedFetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      clearTimeout(timeoutId);

      const json = await response.json();

      if (!response.ok) {
        // Handle error responses
        if (isErrorResponse(json)) {
          throw new Error(json.message || json.error || 'API request failed');
        }
        throw new Error(json.message || `HTTP error! status: ${response.status}`);
      }

      // If response is ApiResponse wrapped, extract the data
      if (json && typeof json === 'object' && 'data' in json && 'success' in json) {
        if (!json.success) {
          throw new Error(json.message || 'API request failed');
        }
        return json.data as T;
      }
      
      // Otherwise return the JSON directly (for non-standardized endpoints)
      return json as T;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Request timeout - server is taking too long to respond');
      }
      throw error;
    }
  }

  private async requestBlob(endpoint: string, options: RequestInit = {}): Promise<Blob> {
    const url = `${API_BASE_URL}${endpoint}`;
    
    const response = await authorizedFetch(url, {
      ...options,
      headers: {
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    return response.blob();
  }

  /**
   * List audio files with optional filtering
   */
  async listAudioFiles(params: {
    patient_id?: string;
    visit_id?: string;
    audio_type?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<AudioListResponse> {
    const searchParams = new URLSearchParams();
    
    if (params.patient_id) searchParams.append('patient_id', params.patient_id);
    if (params.visit_id) searchParams.append('visit_id', params.visit_id);
    if (params.audio_type) searchParams.append('audio_type', params.audio_type);
    if (params.limit) searchParams.append('limit', params.limit.toString());
    if (params.offset) searchParams.append('offset', params.offset.toString());

    const queryString = searchParams.toString();
    const cacheKey = `listAudioFiles-${queryString}`;
    
    // Check cache first
    const cached = this.getCachedData<AudioListResponse>(cacheKey);
    if (cached) {
      return cached;
    }

    const endpoint = `/audio/${queryString ? `?${queryString}` : ''}`;
    const result = await this.request<AudioListResponse>(endpoint);
    
    // Cache the result
    this.setCachedData(cacheKey, result);
    
    return result;
  }

  /**
   * Get audio file metadata by ID
   */
  async getAudioMetadata(audioId: string): Promise<AudioFile> {
    const cacheKey = `getAudioMetadata-${audioId}`;
    
    // Check cache first
    const cached = this.getCachedData<AudioFile>(cacheKey);
    if (cached) {
      return cached;
    }

    const result = await this.request<AudioFile>(`/audio/${audioId}`);
    
    // Cache the result
    this.setCachedData(cacheKey, result);
    
    return result;
  }

  /**
   * Download audio file
   */
  async downloadAudio(audioId: string): Promise<Blob> {
    return this.requestBlob(`/audio/${audioId}/download`);
  }

  /**
   * Get audio file URL for streaming/playback
   */
  getAudioStreamUrl(audioId: string): string {
    return `${API_BASE_URL}/audio/${audioId}/stream`;
  }

  /**
   * Delete audio file
   */
  async deleteAudio(audioId: string): Promise<void> {
    await this.request(`/audio/${audioId}`, {
      method: 'DELETE',
    });
  }

  /**
   * Get audio storage statistics
   */
  async getAudioStats(): Promise<AudioStats> {
    const cacheKey = 'getAudioStats';
    
    // Check cache first
    const cached = this.getCachedData<AudioStats>(cacheKey);
    if (cached) {
      return cached;
    }

    const result = await this.request<AudioStats>('/audio/stats/summary');
    
    // Cache the result
    this.setCachedData(cacheKey, result);
    
    return result;
  }

  /**
   * Get quick list of audio files for fast loading
   */
  async getQuickAudioList(limit: number = 5): Promise<AudioListResponse> {
    const cacheKey = `quickList-${limit}`;
    
    // Check cache first
    const cached = this.getCachedData<AudioListResponse>(cacheKey);
    if (cached) {
      return cached;
    }

    const result = await this.request<AudioListResponse>(`/audio/quick-list?limit=${limit}`);
    
    // Cache the result
    this.setCachedData(cacheKey, result);
    
    return result;
  }

  /**
   * List audio dialogues with optional filtering
   */
  async listAudioDialogues(params: {
    patient_id?: string;
    visit_id?: string;
    audio_type?: string;
    start_date?: string;
    end_date?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<AudioDialogueListResponse> {
    const searchParams = new URLSearchParams();
    
    if (params.patient_id) searchParams.append('patient_id', params.patient_id);
    if (params.visit_id) searchParams.append('visit_id', params.visit_id);
    if (params.audio_type) searchParams.append('audio_type', params.audio_type);
    if (params.start_date) searchParams.append('start_date', params.start_date);
    if (params.end_date) searchParams.append('end_date', params.end_date);
    if (params.limit) searchParams.append('limit', params.limit.toString());
    if (params.offset) searchParams.append('offset', params.offset.toString());

    const queryString = searchParams.toString();
    const cacheKey = `listAudioDialogues-${queryString}`;
    
    // Check cache first
    const cached = this.getCachedData<AudioDialogueListResponse>(cacheKey);
    if (cached) {
      return cached;
    }

    const endpoint = `/audio/dialogue${queryString ? `?${queryString}` : ''}`;
    const result = await this.request<AudioDialogueListResponse>(endpoint);
    
    // Ensure dialogues is always an array
    if (!result.dialogues || !Array.isArray(result.dialogues)) {
      result.dialogues = [];
    }
    
    // Ensure each dialogue has structured_dialogue as an array (never undefined/null)
    result.dialogues = result.dialogues.map(dialogue => ({
      ...dialogue,
      structured_dialogue: Array.isArray(dialogue.structured_dialogue) 
        ? dialogue.structured_dialogue 
        : []
    }));
    
    // Cache the result
    this.setCachedData(cacheKey, result);
    
    return result;
  }

  /**
   * Clear all cached data
   */
  clearAllCache(): void {
    this.clearCache();
  }

  /**
   * Format file size for display
   */
  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Format duration for display
   */
  formatDuration(seconds?: number): string {
    if (!seconds) return 'Unknown';
    
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  /**
   * Get audio type display name
   */
  getAudioTypeDisplayName(audioType: string): string {
    switch (audioType) {
      case 'adhoc':
        return 'Ad-hoc Transcription';
      case 'visit':
        return 'Visit Recording';
      default:
        return audioType.charAt(0).toUpperCase() + audioType.slice(1);
    }
  }
}

export const audioService = new AudioService();
