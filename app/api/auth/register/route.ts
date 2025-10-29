import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const body = await request.json();

  const response = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}/auth/register`,
    {
      method: 'POST',
      body: JSON.stringify(body),
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );

  let responseData;
  try {
    responseData = await response.json();
  } catch (error) {
    return NextResponse.json(
      { message: 'Server error - invalid response' },
      { status: 500 }
    );
  }

  // Check if the server returned an error
  if (
    responseData.error ||
    responseData.statusCode ||
    responseData.validationErrors ||
    !response.ok
  ) {
    return NextResponse.json(
      {
        message:
          responseData.message || responseData.error || 'Registration failed',
      },
      { status: responseData.statusCode || response.status || 500 }
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
