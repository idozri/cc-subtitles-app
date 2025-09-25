import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const cookieStore = await cookies();
  const cookie = cookieStore.toString();

  try {
    const { id } = await params;
    const resp = await fetch(`${BACKEND_URL}/projects/${id}/thumbnail`, {
      method: 'GET',
      headers: {
        Cookie: cookie,
      },
      credentials: 'include',
    });

    if (!resp.ok) {
      return new NextResponse('Not Found', { status: resp.status });
    }

    const arrayBuffer = await resp.arrayBuffer();
    const contentType = resp.headers.get('content-type') || 'image/jpeg';

    return new NextResponse(arrayBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        // Let Next.js image cache this response
        'Cache-Control':
          'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
      },
    });
  } catch (e) {
    return new NextResponse('Failed to fetch thumbnail', { status: 500 });
  }
}
