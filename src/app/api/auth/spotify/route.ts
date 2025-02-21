import { NextResponse } from 'next/server';

export async function GET() {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const redirectUri = process.env.SPOTIFY_REDIRECT_URI;
  
  const scope = [
    'user-read-private',
    'user-read-email',
    'playlist-modify-public',
    'playlist-modify-private',
    'user-read-playback-state',
    'user-modify-playback-state',
    'user-read-currently-playing'
  ].join(' ');

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId!,
    scope,
    redirect_uri: redirectUri!,
    show_dialog: 'true'
  });

  const authUrl = `https://accounts.spotify.com/authorize?${params.toString()}`;
  
  return NextResponse.json({ url: authUrl });
} 