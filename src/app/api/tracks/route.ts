import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';
import { NextRequest } from 'next/server';

// Add export for allowed methods
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Add a type for logging
interface LogMessage {
  step: string;
  message: string;
  timestamp: number;
}

// Add type for tracks
interface Track {
  number: number;
  title: string;
  artist: string;
  album: string;
}

// Add interfaces for YouTube data structure
interface YouTubeContent {
  videoSecondaryInfoRenderer?: {
    description?: {
      runs: YouTubeTextRun[];
    };
    metadataRowContainer?: {
      metadataRowContainerRenderer?: {
        rows: YouTubeRow[];
      };
    };
  };
}

interface YouTubeTextRun {
  text: string;
}

interface YouTubeRow {
  richMetadataRowRenderer?: {
    contents: YouTubeMetadata[];
  };
}

interface YouTubeMetadata {
  richMetadataRenderer?: {
    style: string;
    title?: {
      simpleText: string;
    };
    subtitle?: {
      simpleText: string;
    };
    callToAction?: {
      simpleText: string;
    };
  };
}

export async function POST(request: NextRequest) {
  const logs: LogMessage[] = [];
  
  const log = (step: string, message: string) => {
    const logMessage = { step, message, timestamp: Date.now() };
    logs.push(logMessage);
    console.log(`${step}: ${message}`);
  };

  try {
    log('1', 'Starting track extraction process');
    const { url } = await request.json();
    
    log('2', `Extracting video ID from: ${url}`);
    const videoId = extractVideoId(url);
    if (!videoId) {
      throw new Error('Invalid YouTube URL');
    }
    log('2', `Video ID extracted: ${videoId}`);

    log('3', 'Fetching YouTube page');
    const response = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    if (!response.ok) {
      throw new Error('Failed to fetch YouTube page');
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    log('4', 'Extracting tracks');
    const tracks: Track[] = [];
    
    // Try to extract initial data from script tag
    const scriptContent = $('script').filter((_, el) => {
      const content = $(el).html();
      return content ? content.includes('ytInitialData') : false;
    }).first().html();
    
    if (scriptContent) {
      const dataMatch = scriptContent.match(/var ytInitialData = (.+?);<\/script>/);
      if (dataMatch) {
        try {
          const jsonData = JSON.parse(dataMatch[1]);
          log('4', 'Successfully parsed YouTube initial data');
          
          // Get the video description
          const description = jsonData?.contents?.twoColumnWatchNextResults?.results?.results?.contents
            ?.find((content: YouTubeContent) => content?.videoSecondaryInfoRenderer)
            ?.videoSecondaryInfoRenderer?.description?.runs;

          if (description) {
            log('4', 'Found video description');
            let trackNumber = 1;
            let currentTrack: Partial<Track> = {};
            
            // Process description line by line
            description.forEach((run: YouTubeTextRun) => {
              const text = run.text.trim();
              
              // Skip empty lines
              if (!text) return;
              
              // Look for common track listing patterns
              const trackPattern = /^(\d+\.|[-•]|\d+\)|\d+)\s*(.+)$/;
              const match = text.match(trackPattern);
              
              if (match) {
                // If we have a previous track, push it
                if (currentTrack.title) {
                  tracks.push({
                    number: trackNumber++,
                    title: currentTrack.title || '',
                    artist: currentTrack.artist || 'Unknown Artist',
                    album: currentTrack.album || 'Unknown Album'
                  });
                }
                
                // Start new track
                const trackInfo = match[2].split('-').map((s: string) => s.trim());
                currentTrack = {
                  title: trackInfo[1] || trackInfo[0],
                  artist: trackInfo[0]
                };
              } else if (text.includes(' - ')) {
                // Alternative format: "Artist - Title"
                const [artist, title] = text.split('-').map((s: string) => s.trim());
                if (title && artist) {
                  tracks.push({
                    number: trackNumber++,
                    title,
                    artist,
                    album: 'Unknown Album'
                  });
                }
              }
            });
            
            // Push the last track if exists
            if (currentTrack.title) {
              tracks.push({
                number: trackNumber,
                title: currentTrack.title,
                artist: currentTrack.artist || 'Unknown Artist',
                album: currentTrack.album || 'Unknown Album'
              });
            }
          }

          // If no tracks found in description, try music section
          if (tracks.length === 0) {
            log('4', 'No tracks found in description, checking music section');
            const musicSection = jsonData?.contents?.twoColumnWatchNextResults?.results?.results?.contents
              ?.find((content: YouTubeContent) => content?.videoSecondaryInfoRenderer?.metadataRowContainer)
              ?.videoSecondaryInfoRenderer?.metadataRowContainer?.metadataRowContainerRenderer?.rows
              ?.find((row: YouTubeRow) => 
                row?.richMetadataRowRenderer?.contents?.[0]?.richMetadataRenderer?.style === 'RICH_METADATA_RENDERER_STYLE_BOX'
              );

            if (musicSection) {
              const musicTracks = musicSection?.richMetadataRowRenderer?.contents;
              musicTracks?.forEach((track: YouTubeMetadata, index: number) => {
                const metadata = track?.richMetadataRenderer;
                if (metadata) {
                  tracks.push({
                    number: index + 1,
                    title: metadata?.title?.simpleText || 'Unknown Title',
                    artist: metadata?.subtitle?.simpleText || 'Unknown Artist',
                    album: metadata?.callToAction?.simpleText || 'Unknown Album'
                  });
                }
              });
            }
          }
        } catch (e) {
          log('4', `Failed to parse initial data: ${e instanceof Error ? e.message : 'Unknown error'}`);
        }
      }
    }

    if (tracks.length === 0) {
      throw new Error('No music tracks found in the video');
    }

    log('5', `Successfully extracted ${tracks.length} tracks`);
    const videoTitle = $('title').text().replace(' - YouTube', '').trim();
    return NextResponse.json({ 
      tracks,
      logs,
      videoTitle
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    log('Error', `Error in track extraction: ${errorMessage}`);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to fetch tracks',
        logs
      },
      { status: 500 }
    );
  }
}

// Add OPTIONS method to handle preflight requests
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

function extractVideoId(url: string): string | null {
  // Handle youtu.be format
  if (url.includes('youtu.be')) {
    const id = url.split('youtu.be/')[1]?.split('?')[0];
    return id || null;
  }
  
  // Handle youtube.com format
  const match = url.match(/[?&]v=([^&]+)/);
  return match ? match[1] : null;
} 