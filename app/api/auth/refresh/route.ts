import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    // Forward the refresh request to the server
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/auth/refresh`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Forward cookies to the server (including refresh_token)
          Cookie: request.headers.get('cookie') || '',
        },
      }
    );

    if (!response.ok) {
      const responseData = await response.json().catch(() => ({}));
      return NextResponse.json(
        {
          success: false,
          message: responseData.message || 'Token refresh failed',
        },
        { status: response.status }
      );
    }

    // Create the response
    const nextResponse = NextResponse.json({
      success: true,
      message: 'Tokens refreshed successfully',
    });

    // Forward new cookie headers from server response to client
    const setCookieHeaders = response.headers.getSetCookie();
    setCookieHeaders.forEach((cookie) => {
      nextResponse.headers.append('Set-Cookie', cookie);
    });

    return nextResponse;
  } catch (error) {
    console.error('Token refresh error:', error);
    return NextResponse.json(
      { success: false, message: 'Token refresh failed' },
      { status: 500 }
    );
  }
}
