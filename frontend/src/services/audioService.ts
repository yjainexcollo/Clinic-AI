/**
 * Audio service for managing audio files
 */

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

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

class AudioService {
  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;
    
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    return response.json();
  }

  private async requestBlob(endpoint: string, options: RequestInit = {}): Promise<Blob> {
    const url = `${API_BASE_URL}${endpoint}`;
    
    const response = await fetch(url, {
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
    const endpoint = `/audio/${queryString ? `?${queryString}` : ''}`;
    
    return this.request<AudioListResponse>(endpoint);
  }

  /**
   * Get audio file metadata by ID
   */
  async getAudioMetadata(audioId: string): Promise<AudioFile> {
    return this.request<AudioFile>(`/audio/${audioId}`);
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
    return this.request<AudioStats>('/audio/stats/summary');
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
