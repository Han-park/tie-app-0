"use client";

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Track {
  title: string;
  artist: string;
  album: string;
}

interface SpotifyResults {
  playlist?: {
    id: string;
    name: string;
    url: string;
  };
  results: Array<{
    original: Track;
    spotify: {
      name: string;
      artist: string;
      album: string;
      uri: string;
    };
  }>;
  errors: string[];
}

interface SpotifyBottomSheetProps {
  spotifyTracks: Track[];
  onAddToQueue: () => void;
  onCreatePlaylist: () => void;
  isAddingToSpotify: boolean;
  isCreatingPlaylist: boolean;
  deviceError: boolean;
  spotifyResults: SpotifyResults | null;
  playlistName: string;
  onPlaylistNameChange: (name: string) => void;
  addMethod: 'queue' | 'playlist';
  onMethodChange: (method: 'queue' | 'playlist') => void;
  onReconnectSpotify: () => void;
}

export default function SpotifyBottomSheet({
  spotifyTracks,
  onAddToQueue,
  onCreatePlaylist,
  isAddingToSpotify,
  isCreatingPlaylist,
  deviceError,
  spotifyResults,
  playlistName,
  onPlaylistNameChange,
  addMethod,
  onMethodChange,
  onReconnectSpotify
}: SpotifyBottomSheetProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Auto-expand when new results arrive
  useEffect(() => {
    if (spotifyResults) {
      setIsExpanded(true);
    }
  }, [spotifyResults]);

  return (
    <motion.div
      initial={{ y: "100%" }}
      animate={{ y: 0 }}
      className="fixed bottom-0 left-0 right-0 bg-black/90 border-t shadow-lg"
    >
      <div 
        className="w-16 rounded-full h-1.5 bg-gray-500 mx-auto mt-2 mb-4 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      />

      <motion.div
        animate={{ height: isExpanded ? "auto" : "min-content" }}
        className="px-4 pb-4"
      >
        <div className="flex gap-4 mb-4">
          <button
            onClick={() => onMethodChange('queue')}
            className={`flex-1 px-4 py-2 transition-colors ${
              addMethod === 'queue'
                ? 'bg-green-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Add to Queue
          </button>
          <button
            onClick={() => onMethodChange('playlist')}
            className={`flex-1 px-4 py-2 transition-colors ${
              addMethod === 'playlist'
                ? 'bg-green-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Create Playlist
          </button>
        </div>

        <AnimatePresence>
          {addMethod === 'playlist' && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <input
                type="text"
                value={playlistName}
                onChange={(e) => onPlaylistNameChange(e.target.value)}
                placeholder="Enter playlist name"
                className="w-full p-2 border mb-4 bg-white/10"
              />
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex justify-between items-center">
          {deviceError && addMethod === 'queue' ? (
            <div className="p-4 bg-yellow-50 border border-yellow-200 w-full">
              <h3 className="font-bold text-yellow-800 mb-2">
                No Active Spotify Device Found
              </h3>
              <p className="text-yellow-700 mb-4">
                Please follow these steps:
              </p>
              <ol className="list-decimal list-inside text-yellow-700 mb-4 space-y-2">
                <li>Open Spotify app on your device</li>
                <li>Start playing any track</li>
                <li>Click the retry button below</li>
              </ol>
              <button
                onClick={onAddToQueue}
                disabled={isAddingToSpotify}
                className="px-4 py-2 bg-yellow-600 text-white hover:bg-yellow-700 
                  disabled:bg-yellow-300 disabled:cursor-not-allowed transition-colors
                  flex items-center gap-2"
              >
                {isAddingToSpotify ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Retrying...
                  </>
                ) : (
                  <>
                    <RefreshIcon />
                    Retry Adding to Queue
                  </>
                )}
              </button>
            </div>
          ) : (
            <>
              <button
                onClick={addMethod === 'queue' ? onAddToQueue : onCreatePlaylist}
                disabled={isAddingToSpotify || isCreatingPlaylist || (addMethod === 'playlist' && !playlistName)}
                className="px-4 py-2 bg-green-600 text-white hover:bg-green-700 
                  disabled:bg-green-300 disabled:cursor-not-allowed transition-colors
                  flex items-center gap-2"
              >
                {isAddingToSpotify || isCreatingPlaylist ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    {addMethod === 'queue' ? 'Adding to Queue...' : 'Creating Playlist...'}
                  </>
                ) : (
                  <>
                    <SpotifyIcon />
                    {addMethod === 'queue' ? 'Add to Queue in your Spotify' : 'Create Playlist in your Spotify'}
                  </>
                )}
              </button>
              
              <button
                onClick={onReconnectSpotify}
                className="px-4 py-2 text-red-600 hover:text-red-700 
                  transition-colors flex items-center gap-2"
              >
                Reconnect Spotify
              </button>
            </>
          )}
        </div>

        <AnimatePresence>
          {isExpanded && spotifyResults && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="mt-4 p-4 bg-gray-50 border overflow-hidden"
            >
              <h3 className="font-bold mb-2">Spotify Results:</h3>
              {spotifyResults.playlist && (
                <div className="mb-2 text-green-600">
                  ✓ Created playlist: <a href={spotifyResults.playlist.url} target="_blank" rel="noopener noreferrer" className="underline">{spotifyResults.playlist.name}</a>
                </div>
              )}
              {spotifyResults.results.map((result, index) => (
                <div key={index} className="text-sm text-gray-600 mb-1">
                  ✓ Added: {result.spotify.name} by {result.spotify.artist}
                </div>
              ))}
              {spotifyResults.errors.map((error: string, index: number) => (
                <div key={index} className="text-sm text-red-600 mb-1">
                  ✗ {error}
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="text-sm text-gray-400 mt-2">
          {spotifyTracks.length} tracks selected
        </div>
      </motion.div>
    </motion.div>
  );
}

const SpotifyIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
  </svg>
);

const RefreshIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
); 