import React, { useState, useEffect } from 'react';
import { Search, Filter, RefreshCw, BarChart3, MessageSquare, FileAudio } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { AudioDialogue, AudioDialogueListResponse, AudioStats, audioService } from '../services/audioService';
import TranscriptView from '../components/TranscriptView';

const AudioManagement: React.FC = () => {
  const [audioDialogues, setAudioDialogues] = useState<AudioDialogue[]>([]);
  const [stats, setStats] = useState<AudioStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [audioTypeFilter, setAudioTypeFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedDialogue, setSelectedDialogue] = useState<AudioDialogue | null>(null);

  const limit = 20;

  const loadAudioDialogues = async (page = 0, type = audioTypeFilter, search = searchTerm) => {
    setLoading(true);
    setError(null);
    
    try {
      const filterType = type === 'all' ? undefined : type;
      const response = await audioService.listAudioDialogues({
        audio_type: filterType,
        limit,
        offset: page * limit,
      });
      
      // Validate response structure
      if (!response || !Array.isArray(response.dialogues)) {
        console.error('Invalid response structure:', response);
        setAudioDialogues([]);
        setTotalCount(0);
        return;
      }
      
      // Filter by search term if provided (client-side filtering for now)
      // NOTE: This only filters the current page results. For proper pagination with search,
      // search should be implemented on the backend.
      let filteredDialogues = response.dialogues;
      if (search.trim()) {
        filteredDialogues = response.dialogues.filter(dialogue => {
          if (!dialogue) return false;
          const filename = dialogue.filename?.toLowerCase() || '';
          const audioId = dialogue.audio_id?.toLowerCase() || '';
          const searchLower = search.toLowerCase();
          return filename.includes(searchLower) || audioId.includes(searchLower);
        });
      }
      
      setAudioDialogues(filteredDialogues);
      setTotalCount(response.total_count || 0);
      setCurrentPage(page);
    } catch (err) {
      console.error('Error loading audio dialogues:', err);
      setError(err instanceof Error ? err.message : 'Failed to load audio dialogues');
      setAudioDialogues([]);
      setTotalCount(0);
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
    loadAudioDialogues();
    loadStats();
  }, []);

  const handleRefresh = () => {
    loadAudioDialogues(currentPage, audioTypeFilter, searchTerm);
    loadStats();
  };

  const handlePageChange = (newPage: number) => {
    loadAudioDialogues(newPage, audioTypeFilter, searchTerm);
  };

  const totalPages = Math.ceil(totalCount / limit);

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Audio Dialogues</h1>
        <p className="text-gray-600">View structured conversations from your clinic recordings</p>
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
                <FileAudio className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Ad-hoc</p>
                  <p className="text-2xl font-bold">{stats.adhoc_files}</p>
                </div>
                <MessageSquare className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Visit</p>
                  <p className="text-2xl font-bold">{stats.visit_files}</p>
                </div>
                <BarChart3 className="h-8 w-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Other</p>
                  <p className="text-2xl font-bold">{stats.other_files}</p>
                </div>
                <FileAudio className="h-8 w-8 text-gray-500" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters and Search */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search by filename or ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        <Select value={audioTypeFilter} onValueChange={setAudioTypeFilter}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="adhoc">Ad-hoc</SelectItem>
            <SelectItem value="visit">Visit</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={handleRefresh} variant="outline" className="w-full sm:w-auto">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Dialogue List */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Audio Dialogues ({totalCount})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
                  <p className="mt-2 text-gray-600">Loading dialogues...</p>
                </div>
              ) : audioDialogues.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <MessageSquare className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                  <p>No audio dialogues found</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {audioDialogues.map((dialogue) => (
                    <div
                      key={dialogue.audio_id}
                      className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                        selectedDialogue?.audio_id === dialogue.audio_id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => setSelectedDialogue(dialogue)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{dialogue.filename}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="secondary" className="text-xs">
                              {audioService.getAudioTypeDisplayName(dialogue.audio_type)}
                            </Badge>
                            {dialogue.duration_seconds && (
                              <span className="text-xs text-gray-500">
                                {audioService.formatDuration(dialogue.duration_seconds)}
                              </span>
                            )}
                             {dialogue.structured_dialogue && Array.isArray(dialogue.structured_dialogue) && dialogue.structured_dialogue.length > 0 && (
                               <span className="text-xs text-green-600">
                                 {dialogue.structured_dialogue.length} turns
                               </span>
                             )}
                          </div>
                          <p className="text-xs text-gray-400 mt-1">
                            {new Date(dialogue.created_at).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

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
            </CardContent>
          </Card>
        </div>

        {/* Dialogue Viewer */}
        <div>
          {selectedDialogue ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  {selectedDialogue.filename}
                </CardTitle>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="secondary">
                    {audioService.getAudioTypeDisplayName(selectedDialogue.audio_type)}
                  </Badge>
                  {selectedDialogue.duration_seconds && (
                    <span className="text-sm text-gray-500">
                      {audioService.formatDuration(selectedDialogue.duration_seconds)}
                    </span>
                  )}
                  <span className="text-sm text-gray-400">
                    {new Date(selectedDialogue.created_at).toLocaleString()}
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                 {selectedDialogue.structured_dialogue && Array.isArray(selectedDialogue.structured_dialogue) && selectedDialogue.structured_dialogue.length > 0 ? (
                   <TranscriptView content={JSON.stringify(selectedDialogue.structured_dialogue)} />
                 ) : (
                  <div className="text-center py-8 text-gray-500">
                    <MessageSquare className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                    <p>No structured dialogue available</p>
                    <p className="text-sm mt-2">This recording may not have been processed yet.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-8 text-center text-gray-600">
                <MessageSquare className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                <p>Select a dialogue to view</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default AudioManagement;