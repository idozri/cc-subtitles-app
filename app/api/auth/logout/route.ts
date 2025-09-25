import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    // Forward the logout request to the server to clear HTTP-only cookies
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/auth/logout`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Forward cookies to the server
          Cookie: request.headers.get('cookie') || '',
        },
      }
    );

    console.log(
      'Logout server response:',
      response.status,
      response.statusText
    );
    const responseData = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { success: false, message: responseData.message || 'Logout failed' },
        { status: response.status }
      );
    }

    // Create the response
    const nextResponse = NextResponse.json({ success: true });

    // Forward cookie clearing headers from server response to client
    const setCookieHeaders = response.headers.getSetCookie();
    console.log('Cookie clearing headers from server:', setCookieHeaders);
    setCookieHeaders.forEach((cookie) => {
      console.log('Setting cookie header:', cookie);
      nextResponse.headers.append('Set-Cookie', cookie);
    });

    return nextResponse;
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json(
      { success: false, message: 'Logout failed' },
      { status: 500 }
    );
  }
}
