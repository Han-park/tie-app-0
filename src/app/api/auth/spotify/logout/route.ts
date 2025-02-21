import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST() {
  const cookieStore = cookies();
  
  // Clear all Spotify related cookies
  cookieStore.delete('spotify_access_token');
  cookieStore.delete('spotify_refresh_token');
  
  return NextResponse.json({ success: true });
} 