import { NextRequest, NextResponse } from 'next/server';

async function createPlaylist(name: string, accessToken: string) {
  // Get user ID first
  const userResponse = await fetch('https://api.spotify.com/v1/me', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  const userData = await userResponse.json();

  // Create playlist
  const playlistResponse = await fetch(
    `https://api.spotify.com/v1/users/${userData.id}/playlists`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name,
        description: 'Created from Tie',
        public: false,
      }),
    }
  );
  return await playlistResponse.json();
}

async function addTracksToPlaylist(playlistId: string, trackUris: string[], accessToken: string) {
  const response = await fetch(
    `https://api.spotify.com/v1/playlists/${playlistId}/tracks`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        uris: trackUris,
      }),
    }
  );
  return response.ok;
}

export async function POST(request: NextRequest) {
  try {
    const { tracks, playlistName, accessToken } = await request.json();
    console.log('🎵 Creating playlist:', playlistName);

    const results = [];
    const errors = [];
    const trackUris = [];

    // First, search for all tracks
    for (const track of tracks) {
      try {
        const response = await fetch(
          `https://api.spotify.com/v1/search?q=${encodeURIComponent(`${track.title} ${track.artist}`)}&type=track&limit=1`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          }
        );
        const data = await response.json();
        const spotifyTrack = data.tracks?.items[0];

        if (spotifyTrack) {
          trackUris.push(spotifyTrack.uri);
          results.push({
            original: track,
            spotify: {
              name: spotifyTrack.name,
              artist: spotifyTrack.artists[0].name,
              album: spotifyTrack.album.name,
              uri: spotifyTrack.uri
            }
          });
        } else {
          errors.push(`Could not find "${track.title}" on Spotify`);
        }
      } catch (error) {
        errors.push(`Error processing "${track.title}": ${(error as Error).message}\n${(error as Error).stack}`);
      }
    }

    if (trackUris.length > 0) {
      // Create playlist
      const playlist = await createPlaylist(playlistName, accessToken);
      
      // Add tracks to playlist
      await addTracksToPlaylist(playlist.id, trackUris, accessToken);
      
      return NextResponse.json({
        results,
        errors,
        playlist: {
          id: playlist.id,
          name: playlist.name,
          url: playlist.external_urls.spotify
        }
      });
    }

    return NextResponse.json({ results, errors });
  } catch (error) {
    console.error('Failed to create playlist:', error);
    return NextResponse.json(
      { error: 'Failed to create playlist' },
      { status: 500 }
    );
  }
} 