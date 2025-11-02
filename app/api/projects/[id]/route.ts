import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const cookieStore = await request.cookies;
  const cookie = cookieStore.toString();
  try {
    const { id } = await params;

    // Forward the request to the backend
    const response = await fetch(`${BACKEND_URL}/projects/${id}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookie,
      },
      credentials: 'include',
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
    console.error('Error loading project:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Failed to load project',
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const cookieStore = await request.cookies;
  const cookie = cookieStore.toString();

  try {
    const { id } = await params;

    // Forward the delete request to the backend
    const response = await fetch(`${BACKEND_URL}/projects/${id}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookie,
      },
      credentials: 'include',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.message || `Backend responded with status: ${response.status}`
      );
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('Error deleting project:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Failed to delete project',
      },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const cookieStore = await request.cookies;
  const cookie = cookieStore.toString();

  const { id } = await params;

  try {
    const body = await request.json();
    const response = await fetch(`${BACKEND_URL}/projects/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookie,
      },
      credentials: 'include',
      body: JSON.stringify(body),
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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const cookieStore = await request.cookies;
  const cookie = cookieStore.toString();
  const { id } = await params;

  try {
    const body = await request.json();
    const response = await fetch(
      `${BACKEND_URL}/projects/${id}/transcription`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: cookie,
        },
        credentials: 'include',
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.message || `Backend responded with status: ${response.status}`
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error saving transcription:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to save transcription',
      },
      { status: 500 }
    );
  }
}
