"use client";

import Image from "next/image";
import { useState } from "react";
import { useRouter } from 'next/navigation';

interface Track {
  number: number;
  title: string;
  artist: string;
  album: string;
}

// Skeleton component for loading state
const TrackSkeleton = () => (
  <div className="flex items-center gap-4 p-4 border rounded animate-pulse">
    <div className="w-8 flex-shrink-0 text-gray-300">#</div>
    <div className="flex-1">
      <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
      <div className="h-3 bg-gray-200 rounded w-1/2 mb-2"></div>
      <div className="h-3 bg-gray-200 rounded w-2/3"></div>
    </div>
  </div>
);

export default function Home() {
  const [videoUrl, setVideoUrl] = useState("");
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<Array<{ step: string; message: string; timestamp: number }>>([]);
  const [isAddingToSpotify, setIsAddingToSpotify] = useState(false);
  const [spotifyResults, setSpotifyResults] = useState<any>(null);
  const [deviceError, setDeviceError] = useState(false);
  const [playlistName, setPlaylistName] = useState("");
  const [addMethod, setAddMethod] = useState<'queue' | 'playlist'>('queue');
  const [isCreatingPlaylist, setIsCreatingPlaylist] = useState(false);
  const router = useRouter();

  const extractVideoId = (url: string): string | null => {
    // Handle youtu.be format
    if (url.includes('youtu.be')) {
      const id = url.split('youtu.be/')[1]?.split('?')[0];
      return id || null;
    }
    
    // Handle youtube.com format
    const match = url.match(/[?&]v=([^&]+)/);
    return match ? match[1] : null;
  };

  const handleUrlSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setLogs([]); // Clear previous logs

    try {
      const response = await fetch('/api/tracks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: videoUrl }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch tracks');
      }

      setTracks(data.tracks);
      setLogs(data.logs); // Set the logs from the response
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleAddToSpotify = async () => {
    if (!tracks.length) return;

    setIsAddingToSpotify(true);
    setDeviceError(false);
    try {
      const tokenResponse = await fetch('/api/auth/spotify/token');
      const tokenData = await tokenResponse.json();

      if (!tokenData.accessToken || tokenData.error?.status === 401) {
        // Clear tokens and redirect to Spotify login
        await fetch('/api/auth/spotify/logout', { method: 'POST' });
        router.push('/spotify');
        return;
      }

      const response = await fetch('/api/spotify/queue', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tracks,
          accessToken: tokenData.accessToken,
        }),
      });

      const data = await response.json();
      
      if (response.status === 401) {
        // Token expired or invalid, logout and redirect
        await fetch('/api/auth/spotify/logout', { method: 'POST' });
        router.push('/spotify');
        return;
      }
      
      if (response.status === 404) {
        setDeviceError(true);
      } else {
        setSpotifyResults(data);
      }
    } catch (error) {
      setError('Failed to add tracks to Spotify queue');
    } finally {
      setIsAddingToSpotify(false);
    }
  };

  const handleCreatePlaylist = async () => {
    if (!tracks.length) return;

    setIsCreatingPlaylist(true);
    try {
      const tokenResponse = await fetch('/api/auth/spotify/token');
      const tokenData = await tokenResponse.json();

      if (!tokenData.accessToken || tokenData.error?.status === 401) {
        await fetch('/api/auth/spotify/logout', { method: 'POST' });
        router.push('/spotify');
        return;
      }

      const response = await fetch('/api/spotify/playlist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tracks,
          playlistName,
          accessToken: tokenData.accessToken,
        }),
      });

      const data = await response.json();
      setSpotifyResults(data);
    } catch (error) {
      setError('Failed to create playlist');
    } finally {
      setIsCreatingPlaylist(false);
    }
  };

  return (
    <div className="min-h-screen p-8">
      <main className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-8">YouTube Mix Set Bookmarker</h1>
        
        <form onSubmit={handleUrlSubmit} className="mb-8">
          <input
            type="text"
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            placeholder="Paste YouTube URL here"
            className="w-full p-2 border rounded"
          />
          <div className="mt-2 space-y-2">
            <button 
              type="submit"
              disabled={loading}
              className={`w-full px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 
                disabled:bg-red-300 disabled:cursor-not-allowed transition-colors`}
            >
              {loading ? 'Loading Tracks...' : 'Load Tracks'}
            </button>

            {/* Real-time log display */}
            {loading && (
              <div className="animate-fade-in">
                <div className="p-3 bg-gray-50 rounded border border-gray-200">
                  <div className="flex items-center gap-2 mb-2 text-sm text-gray-600">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    {logs.length === 0 ? 'Initializing...' : (
                      logs.some(log => log.step === '12' && log.message.startsWith('Found track'))
                        ? 'Finding tracks...'
                        : logs[logs.length - 1]?.message || 'Processing...'
                    )}
                  </div>
                  <div className="space-y-1 text-sm font-mono max-h-32 overflow-y-auto">
                    {logs
                      .filter(log => 
                        // Only show important logs
                        log.step === '12' && (
                          log.message.startsWith('Found track') ||
                          log.message.includes('Successfully found')
                        )
                      )
                      .map((log, index) => (
                        <div 
                          key={index} 
                          className="text-gray-700 animate-fade-in"
                          style={{ 
                            animationDelay: `${index * 100}ms`,
                            fontSize: '0.75rem'
                          }}
                        >
                          {log.message.startsWith('Found track') ? (
                            <span className="text-green-600">
                              {log.message.replace('Found track', '🎵 Track')}
                            </span>
                          ) : (
                            <span className="text-blue-600">
                              {log.message.replace('Successfully found', '✨ Found')}
                            </span>
                          )}
                        </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </form>

        {error && (
          <div className="mb-4 p-4 bg-red-100 text-red-700 rounded animate-fade-in">
            {error}
          </div>
        )}

        {videoUrl && (
          <div className="mb-8">
            <iframe
              width="100%"
              height="315"
              src={`https://www.youtube.com/embed/${extractVideoId(videoUrl)}`}
              title="YouTube video player"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="rounded"
            />
          </div>
        )}

        <div className="grid gap-4">
          {loading ? (
            <>
              <TrackSkeleton />
              <TrackSkeleton />
              <TrackSkeleton />
            </>
          ) : (
            tracks.map((track) => (
              <div key={`${track.title}-${track.artist}`} className="flex items-center gap-4 p-4 border rounded">
                <div className="w-8 flex-shrink-0 text-gray-500 font-mono">
                  {track.number}
                </div>
                <div>
                  <h3 className="font-bold">{track.title}</h3>
                  <p className="text-gray-600">{track.artist}</p>
                  <p className="text-gray-500 text-sm">{track.album}</p>
                </div>
              </div>
            ))
          )}
        </div>

        {tracks.length > 0 && (
          <div className="mb-4 space-y-4">
            <div className="flex flex-col gap-4">
              <div className="flex gap-4">
                <button
                  onClick={() => setAddMethod('queue')}
                  className={`flex-1 px-4 py-2 rounded transition-colors ${
                    addMethod === 'queue'
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Add to Queue
                </button>
                <button
                  onClick={() => setAddMethod('playlist')}
                  className={`flex-1 px-4 py-2 rounded transition-colors ${
                    addMethod === 'playlist'
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Create Playlist
                </button>
              </div>

              {addMethod === 'playlist' && (
                <input
                  type="text"
                  value={playlistName}
                  onChange={(e) => setPlaylistName(e.target.value)}
                  placeholder="Enter playlist name"
                  className="w-full p-2 border rounded"
                />
              )}

              <div className="flex justify-between items-center">
                {deviceError && addMethod === 'queue' ? (
                  <div className="p-4 bg-yellow-50 border border-yellow-200 rounded">
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
                      onClick={handleAddToSpotify}
                      disabled={isAddingToSpotify}
                      className="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700 
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
                      onClick={addMethod === 'queue' ? handleAddToSpotify : handleCreatePlaylist}
                      disabled={isAddingToSpotify || isCreatingPlaylist || (addMethod === 'playlist' && !playlistName)}
                      className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 
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
                          {addMethod === 'queue' ? 'Add to Queue' : 'Create Playlist'}
                        </>
                      )}
                    </button>
                    
                    <button
                      onClick={async () => {
                        await fetch('/api/auth/spotify/logout', { method: 'POST' });
                        router.push('/spotify');
                      }}
                      className="px-4 py-2 text-red-600 hover:text-red-700 
                        transition-colors flex items-center gap-2"
                    >
                      Reconnect Spotify
                    </button>
                  </>
                )}
              </div>
            </div>
            
            {spotifyResults && (
              <div className="mt-4 p-4 bg-gray-50 rounded border">
                <h3 className="font-bold mb-2">Spotify Results:</h3>
                {spotifyResults.playlist && (
                  <div className="mb-2 text-green-600">
                    ✓ Created playlist: <a href={spotifyResults.playlist.url} target="_blank" rel="noopener noreferrer" className="underline">{spotifyResults.playlist.name}</a>
                  </div>
                )}
                {spotifyResults.results.map((result: any, index: number) => (
                  <div key={index} className="text-sm text-gray-600 mb-1">
                    ✓ Added: {result.spotify.name} by {result.spotify.artist}
                  </div>
                ))}
                {spotifyResults.errors.map((error: string, index: number) => (
                  <div key={index} className="text-sm text-red-600 mb-1">
                    ✗ {error}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
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
