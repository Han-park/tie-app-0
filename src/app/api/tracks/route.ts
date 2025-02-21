import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';
import puppeteer from 'puppeteer-core';
import chromium from 'chrome-aws-lambda';
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

export async function POST(request: NextRequest) {
  const logs: LogMessage[] = [];
  const tracks: Track[] = [];
  
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

    log('3', 'Launching Puppeteer');
    const browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath,
      headless: chromium.headless,
    });

    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    
    try {
      log('4', 'Navigating to YouTube page');
      await page.goto(`https://www.youtube.com/watch?v=${videoId}`, {
        waitUntil: 'networkidle0',
        timeout: 30000
      });
      log('4', 'Page loaded successfully');

      log('5', 'Waiting for content to load');
      await page.waitForSelector('#content', { timeout: 10000 });
      log('5', 'Content loaded');

      log('6', 'Looking for description container');
      const descriptionSelectors = [
        'ytd-text-inline-expander',
        'tp-yt-paper-button#expand',
        '.ytd-text-inline-expander #expand',
        'button[id="expand"]',
        'tp-yt-paper-button[id="expand"]'
      ];

      let descriptionFound = false;
      for (const selector of descriptionSelectors) {
        try {
          log('6', `Trying selector: ${selector}`);
          await page.waitForSelector(selector, { timeout: 2000 });
          descriptionFound = true;
          log('6', `Found description with selector: ${selector}`);
          break;
        } catch {
          log('6', `Selector ${selector} not found`);
        }
      }

      if (!descriptionFound) {
        throw new Error('Could not find video description');
      }

      log('7', 'Scrolling to make description visible');
      await page.evaluate(() => {
        // Scroll a bit more to ensure the button is in view
        window.scrollBy(0, 700);
      });
      await new Promise(resolve => setTimeout(resolve, 1500));
      log('7', 'Scrolled and waited');

      log('8', 'Attempting to expand description');
      try {
        // Try clicking using JavaScript directly
        await page.evaluate(() => {
          const expandButton = document.querySelector('tp-yt-paper-button#expand');
          if (expandButton) {
            (expandButton as HTMLElement).click();
            return true;
          }
          
          // Fallback to text content search
          const buttons = Array.from(document.querySelectorAll('button, tp-yt-paper-button'));
          const showMoreButton = buttons.find(button => 
            button.textContent?.includes('더보기') || // Korean
            button.textContent?.includes('Show more') || // English
            button.textContent?.includes('...more') // Alternative text
          );
          
          if (showMoreButton) {
            (showMoreButton as HTMLElement).click();
            return true;
          }
          
          return false;
        });
        
        log('8', 'Successfully clicked expand button');
      } catch (e: unknown) {
        // Type guard for Error
        const errorMessage = e instanceof Error ? e.message : 'Unknown error';
        log('8', `Failed to click expand button: ${errorMessage}`);
        throw new Error('Could not expand video description');
      }

      // Wait longer for the content to load after expansion
      await new Promise(resolve => setTimeout(resolve, 2500));

      log('11', 'Getting page content and parsing');
      const content = await page.content();
      const $ = cheerio.load(content);

      log('12', 'Extracting tracks');
      
      // Updated selectors to specifically target music section
      const musicSectionSelectors = [
        '#items ytd-horizontal-card-list-renderer[section-identifier="music"]',
        '#contents ytd-horizontal-card-list-renderer[section-identifier="music"]',
        // Backup selectors
        'ytd-horizontal-card-list-renderer:contains("Music")',
        '#contents ytd-horizontal-card-list-renderer'
      ];

      let musicSectionFound = false;
      for (const sectionSelector of musicSectionSelectors) {
        try {
          log('12', `Looking for music section with selector: ${sectionSelector}`);
          const musicSection = $(sectionSelector);
          
          if (musicSection.length > 0) {
            log('12', 'Found music section');
            musicSectionFound = true;

            // Create a Set to store unique track identifiers
            const uniqueTracks = new Set();
            let trackNumber = 1;

            // Updated track selectors within music section
            musicSection.find('.yt-video-attribute-view-model__link-container').each((_, element) => {
              const title = $(element).find('.yt-video-attribute-view-model__title').first().text().trim();
              const artist = $(element).find('.yt-video-attribute-view-model__subtitle span').first().text().trim();
              const album = $(element).find('.yt-video-attribute-view-model__secondary-subtitle span').first().text().trim();

              // Skip if it looks like a person
              if (title && artist && !$(element).closest('[section-identifier="people"]').length) {
                const trackId = `${title}-${artist}`.toLowerCase();
                
                if (!uniqueTracks.has(trackId)) {
                  uniqueTracks.add(trackId);
                  tracks.push({
                    number: trackNumber,
                    title,
                    artist,
                    album
                  });
                  
                  log('12', `Found track ${trackNumber}: ${title} by ${artist}`);
                  trackNumber++;
                } else {
                  log('12', `Skipping duplicate track: ${title} by ${artist}`);
                }
              }
            });

            if (tracks.length > 0) {
              log('12', `Successfully found ${tracks.length} unique tracks in music section`);
              break;
            }
          }
        } catch {
          log('12', `Failed with selector ${sectionSelector}, trying next...`);
        }
      }

      if (!musicSectionFound) {
        log('12', 'Could not find music section');
      }

      if (tracks.length === 0) {
        throw new Error('No music tracks found in the video');
      }

      log('13', 'Process completed successfully');
      const videoTitle = $('title').text().replace(' - YouTube', '').trim();
      return NextResponse.json({ 
        tracks,
        logs,
        videoTitle
      });
    } finally {
      log('14', 'Closing browser');
      await browser.close();
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    log('Error', `Error in track extraction: ${errorMessage}`);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to fetch tracks',
        logs // Include logs in the response
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