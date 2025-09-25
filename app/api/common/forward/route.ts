import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export const runtime = 'nodejs';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

type ForwardBody = {
  method: string;
  url: string;
  body?: unknown;
};

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const cookie = cookieStore.toString();
    const payload = (await request.json()) as ForwardBody;

    if (!payload?.url || !payload?.method)
      return NextResponse.json({ message: 'Invalid payload' }, { status: 400 });

    const method = String(payload.method || 'GET').toUpperCase();
    const allowed = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);
    if (!allowed.has(method))
      return NextResponse.json(
        { message: 'Method not allowed' },
        { status: 405 }
      );

    const resp = await fetch(`${BACKEND_URL}${payload.url}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookie,
      },
      body:
        method === 'GET' || method === 'DELETE'
          ? undefined
          : JSON.stringify(payload.body ?? {}),
    });

    const text = await resp.text();
    const contentType = resp.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      return NextResponse.json(JSON.parse(text), { status: resp.status });
    }
    return new NextResponse(text, {
      status: resp.status,
      headers: { 'content-type': contentType },
    });
  } catch (err) {
    return NextResponse.json({ message: 'Forward failed' }, { status: 502 });
  }
}
