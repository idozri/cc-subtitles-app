import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const cookie = cookieStore.toString();

  try {
    const body = await request.json();

    // Log the incoming request for debugging
    console.log(
      'Frontend API: Upload completion request body:',
      JSON.stringify(body, null, 2)
    );
    console.log(
      'Frontend API: Backend URL:',
      `${process.env.NEXT_PUBLIC_API_URL}/upload/complete`
    );

    // Forward the request to the backend server
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/upload/complete`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: cookie,
        },
        body: JSON.stringify(body),
        credentials: 'include',
      }
    );

    const data = await response.json();

    // Log the backend response for debugging
    console.log('Frontend API: Backend response status:', response.status);
    console.log(
      'Frontend API: Backend response data:',
      JSON.stringify(data, null, 2)
    );

    if (!response.ok) {
      console.error(
        'Frontend API: Backend returned error status:',
        response.status
      );
      console.error(
        'Frontend API: Backend error message:',
        data.message || 'No error message'
      );
      console.error('Frontend API: Backend error details:', data);

      return NextResponse.json(
        {
          error: data.message || 'Upload completion failed',
          details: data,
          status: response.status,
        },
        { status: response.status }
      );
    }

    console.log('Frontend API: Upload completion successful');
    return NextResponse.json(data);
  } catch (error) {
    console.error('Frontend API: Upload completion error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
