import { NextRequest, NextResponse } from 'next/server';

async function searchTrack(query: string, accessToken: string) {
  console.log(`🔍 Searching for track: "${query}"`);
  
  const response = await fetch(
    `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=1`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );
  const data = await response.json();
  
  if (data.tracks?.items[0]) {
    console.log(`✅ Found track: "${data.tracks.items[0].name}" by ${data.tracks.items[0].artists[0].name}`);
  } else {
    console.log(`❌ No track found for query: "${query}"`);
  }
  
  return data.tracks?.items[0];
}

async function addToQueue(trackUri: string, accessToken: string) {
  console.log(`📱 Attempting to add track to queue: ${trackUri}`);
  
  try {
    const response = await fetch(
      `https://api.spotify.com/v1/me/player/queue?uri=${trackUri}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    // Check if there's an active device
    if (response.status === 404) {
      console.log('❌ No active Spotify device found. Please open Spotify and start playing.');
      return false;
    }

    console.log(`${response.ok ? '✅' : '❌'} Queue response status: ${response.status}`);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.log('Error details:', errorData);
    }
    
    return response.ok;
  } catch (error) {
    console.error('❌ Failed to add to queue:', error);
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log('🎵 Starting track queue process');
    const { tracks, accessToken } = await request.json();
    console.log(`📋 Processing ${tracks.length} tracks`);

    // Define the type for the results array
    type TrackResult = {
      original: { title: string; artist: string }; // Adjust based on your track structure
      spotify: {
        name: string;
        artist: string;
        album: string;
        uri: string;
      };
    };

    const results: TrackResult[] = []; // Explicitly define the type here
    const errors: string[] = [];

    // Check for active device first
    const playerResponse = await fetch('https://api.spotify.com/v1/me/player', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    
    if (playerResponse.status === 204) {
      console.log('⚠️ No active device found. Please open Spotify and start playing.');
      return NextResponse.json({
        error: 'No active Spotify device found. Please open Spotify and start playing.',
        results,
        errors: ['No active Spotify device. Open Spotify and start playing music first.']
      }, { status: 404 });
    }

    for (const track of tracks) {
      try {
        console.log(`\n🎵 Processing track: "${track.title}" by ${track.artist}`);
        
        // Create a more specific search query including remix info
        const query = `${track.title} ${track.artist}`;
        const spotifyTrack = await searchTrack(query, accessToken);

        if (spotifyTrack) {
          const added = await addToQueue(spotifyTrack.uri, accessToken);
          if (added) {
            results.push({
              original: track,
              spotify: {
                name: spotifyTrack.name,
                artist: spotifyTrack.artists[0].name,
                album: spotifyTrack.album.name,
                uri: spotifyTrack.uri
              }
            });
            console.log(`✅ Successfully added "${spotifyTrack.name}" to queue`);
          } else {
            const error = `Failed to add "${track.title}" to queue`;
            console.log(`❌ ${error}`);
            errors.push(error);
          }
        } else {
          const error = `Could not find "${track.title}" on Spotify`;
          console.log(`❌ ${error}`);
          errors.push(error);
        }
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const message = `Error processing "${track.title}": ${errorMessage}`;
        console.error(`❌ ${message}`);
        errors.push(message);
      }

      // Add a small delay between requests to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log(`\n📊 Final results: ${results.length} added, ${errors.length} failed`);
    return NextResponse.json({ results, errors });
  } catch (error) {
    console.error('❌ Failed to process tracks:', error);
    return NextResponse.json(
      { error: 'Failed to process tracks' },
      { status: 500 }
    );
  }
} 