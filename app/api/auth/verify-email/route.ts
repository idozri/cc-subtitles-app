import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const body = await request.json();

  const response = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}/auth/verify-email`,
    {
      method: 'POST',
      body: JSON.stringify(body),
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    }
  );

  const responseData = await response.json();

  if (responseData.error) {
    return NextResponse.json(
      { error: responseData.message },
      { status: responseData.statusCode || response.status }
    );
  }

  // Create the response
  const nextResponse = NextResponse.json(responseData);

  // Forward cookies from server response to client
  const setCookieHeaders = response.headers.getSetCookie();

  setCookieHeaders.forEach((cookie) => {
    nextResponse.headers.append('Set-Cookie', cookie);
  });

  return nextResponse;
}




