import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST() {
  try {
    const cookieStore = await cookies();
    
    // Clear all Spotify related cookies
    cookieStore.delete('spotify_access_token');
    cookieStore.delete('spotify_refresh_token');
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to clear cookies:', error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
} 