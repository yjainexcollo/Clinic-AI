import React, { useState, useEffect } from 'react';
import { Search, Filter, RefreshCw, BarChart3, Music, FileAudio } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { AudioPlayer } from '../components/AudioPlayer';
import { AudioFile, AudioListResponse, AudioStats, audioService } from '../services/audioService';

const AudioManagement: React.FC = () => {
  const [audioFiles, setAudioFiles] = useState<AudioFile[]>([]);
  const [stats, setStats] = useState<AudioStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [audioTypeFilter, setAudioTypeFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedAudio, setSelectedAudio] = useState<AudioFile | null>(null);

  const limit = 20;

  const loadAudioFiles = async (page = 0, type = audioTypeFilter, search = searchTerm) => {
    try {
      setLoading(true);
      setError(null);

      const params: any = {
        limit,
        offset: page * limit,
      };

      if (type !== 'all') {
        params.audio_type = type;
      }

      const response: AudioListResponse = await audioService.listAudioFiles(params);
      
      // Filter by search term if provided
      let filteredFiles = response.files;
      if (search) {
        filteredFiles = response.files.filter(file =>
          file.filename.toLowerCase().includes(search.toLowerCase()) ||
          file.patient_id?.toLowerCase().includes(search.toLowerCase()) ||
          file.visit_id?.toLowerCase().includes(search.toLowerCase())
        );
      }

      setAudioFiles(filteredFiles);
      setTotalCount(response.total_count);
      setCurrentPage(page);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load audio files');
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const statsData = await audioService.getAudioStats();
      setStats(statsData);
    } catch (err) {
      console.error('Failed to load stats:', err);
    }
  };

  useEffect(() => {
    loadAudioFiles();
    loadStats();
  }, []);

  const handleSearch = () => {
    setCurrentPage(0);
    loadAudioFiles(0, audioTypeFilter, searchTerm);
  };

  const handleFilterChange = (type: string) => {
    setAudioTypeFilter(type);
    setCurrentPage(0);
    loadAudioFiles(0, type, searchTerm);
  };

  const handleRefresh = () => {
    loadAudioFiles(currentPage, audioTypeFilter, searchTerm);
    loadStats();
  };

  const handleDeleteAudio = async (audioId: string) => {
    if (!confirm('Are you sure you want to delete this audio file?')) {
      return;
    }

    try {
      await audioService.deleteAudio(audioId);
      setAudioFiles(prev => prev.filter(file => file.audio_id !== audioId));
      if (selectedAudio?.audio_id === audioId) {
        setSelectedAudio(null);
      }
      loadStats(); // Refresh stats
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete audio file');
    }
  };

  const handlePageChange = (newPage: number) => {
    loadAudioFiles(newPage, audioTypeFilter, searchTerm);
  };

  const totalPages = Math.ceil(totalCount / limit);

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Audio Management</h1>
        <p className="text-gray-600">Manage and play audio recordings from your clinic</p>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Files</p>
                  <p className="text-2xl font-bold">{stats.total_files}</p>
                </div>
                <BarChart3 className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Ad-hoc Recordings</p>
                  <p className="text-2xl font-bold">{stats.adhoc_files}</p>
                </div>
                <Music className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Visit Recordings</p>
                  <p className="text-2xl font-bold">{stats.visit_files}</p>
                </div>
                <FileAudio className="h-8 w-8 text-purple-600" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Other Files</p>
                  <p className="text-2xl font-bold">{stats.other_files}</p>
                </div>
                <FileAudio className="h-8 w-8 text-gray-600" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters and Search */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search by filename, patient ID, or visit ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Select value={audioTypeFilter} onValueChange={handleFilterChange}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Filter by type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="adhoc">Ad-hoc Recordings</SelectItem>
                  <SelectItem value="visit">Visit Recordings</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={handleSearch} variant="outline">
                <Search className="h-4 w-4 mr-2" />
                Search
              </Button>
              <Button onClick={handleRefresh} variant="outline">
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Error Message */}
      {error && (
        <div className="mb-4 p-4 bg-red-100 border border-red-300 rounded-md text-red-700">
          {error}
        </div>
      )}

      {/* Audio Files List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Files List */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle>Audio Files ({totalCount})</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="p-8 text-center">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  <p className="mt-2 text-gray-600">Loading audio files...</p>
                </div>
              ) : audioFiles.length === 0 ? (
                <div className="p-8 text-center text-gray-600">
                  <FileAudio className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                  <p>No audio files found</p>
                </div>
              ) : (
                <div className="divide-y">
                  {audioFiles.map((file) => (
                    <div
                      key={file.audio_id}
                      className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors ${
                        selectedAudio?.audio_id === file.audio_id ? 'bg-blue-50 border-l-4 border-blue-500' : ''
                      }`}
                      onClick={() => setSelectedAudio(file)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium truncate">{file.filename}</h3>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="secondary" className="text-xs">
                              {audioService.getAudioTypeDisplayName(file.audio_type)}
                            </Badge>
                            <span className="text-sm text-gray-600">
                              {audioService.formatFileSize(file.file_size)}
                            </span>
                            {file.duration_seconds && (
                              <span className="text-sm text-gray-600">
                                {audioService.formatDuration(file.duration_seconds)}
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-500 mt-1">
                            {new Date(file.created_at).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-4 flex justify-center">
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 0}
                >
                  Previous
                </Button>
                <span className="flex items-center px-4 text-sm text-gray-600">
                  Page {currentPage + 1} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage >= totalPages - 1}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Audio Player */}
        <div>
          {selectedAudio ? (
            <AudioPlayer
              audioFile={selectedAudio}
              onDelete={handleDeleteAudio}
              showMetadata={true}
            />
          ) : (
            <Card>
              <CardContent className="p-8 text-center text-gray-600">
                <Music className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                <p>Select an audio file to play</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default AudioManagement;
