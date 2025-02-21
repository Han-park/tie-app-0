import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  const cookieStore = cookies();
  const accessToken = cookieStore.get('spotify_access_token');
  
  if (!accessToken) {
    try {
      // Try to refresh the token using absolute URL
      const refreshResponse = await fetch(`${request.nextUrl.origin}/api/auth/spotify/refresh`);
      if (refreshResponse.ok) {
        const data = await refreshResponse.json();
        return NextResponse.json({ accessToken: data.accessToken });
      }
    } catch (error) {
      console.error('Failed to refresh token:', error);
    }
    return NextResponse.json({ error: 'No token found' }, { status: 401 });
  }

  return NextResponse.json({ accessToken: accessToken.value });
} 