import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const cookie = cookieStore.toString();
  try {
    const body = await request.json();
    const { projectId, s3Key } = body;

    if (!projectId || !s3Key) {
      return NextResponse.json(
        { error: 'Project ID and S3 key are required' },
        { status: 400 }
      );
    }

    // Forward the request to the backend server
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/upload/get-upload-details`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: cookie, // Forward cookies manually
        },
        body: JSON.stringify({ projectId, s3Key }),
        credentials: 'include',
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: data.message || 'Failed to get upload details' },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Get upload details error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
