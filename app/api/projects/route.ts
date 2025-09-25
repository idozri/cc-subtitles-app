import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  const cookie = cookieStore.toString();
  try {
    // Extract device ID from request headers
    const deviceId = request.headers.get('x-device-id');

    // Forward the request to the backend
    const response = await fetch(`${BACKEND_URL}/projects`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookie,
        ...(deviceId && { 'X-Device-ID': deviceId }),
      },
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error(`Backend responded with status: ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error loading projects:', error);
    return NextResponse.json(
      { error: 'Failed to load projects' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const cookie = cookieStore.toString();

  try {
    const requestBody = await request.json();

    // Forward the request to the backend
    const response = await fetch(`${BACKEND_URL}/projects`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookie,
      },
      credentials: 'include',
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.message || `Backend responded with status: ${response.status}`
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error creating project:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Failed to create project',
      },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  const cookieStore = await cookies();
  const cookie = cookieStore.toString();

  try {
    // Forward the request to the backend
    const response = await fetch(`${BACKEND_URL}/projects`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookie,
      },
      credentials: 'include',
      body: JSON.stringify(await request.json()),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.message || `Backend responded with status: ${response.status}`
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error updating project:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Failed to update project',
      },
      { status: 500 }
    );
  }
}
