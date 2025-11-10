import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export async function DELETE(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const cookie = cookieStore.toString();

    const response = await fetch(`${BACKEND_URL}/users/me`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookie,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return NextResponse.json(
        { error: errorData.message || 'Failed to delete user account' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Delete user API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
