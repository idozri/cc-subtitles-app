import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';

export const runtime = 'nodejs';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const target = url.searchParams.get('url');
  const jobId = url.searchParams.get('jobId');
  if (!target || !jobId) {
    return new Response(JSON.stringify({ message: 'Missing url or jobId' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }

  const cookieStore = await cookies();
  const cookie = cookieStore.toString();

  const backendUrl = `${BACKEND_URL}${target}?jobId=${encodeURIComponent(
    jobId
  )}`;
  const resp = await fetch(backendUrl, {
    method: 'GET',
    headers: {
      Cookie: cookie,
      Accept: 'text/event-stream',
      Connection: 'keep-alive',
      'Cache-Control': 'no-cache',
    },
  });

  // Pipe SSE stream to client
  const headers = new Headers();
  headers.set('Content-Type', 'text/event-stream');
  headers.set('Cache-Control', 'no-cache');
  headers.set('Connection', 'keep-alive');

  return new Response(resp.body, { headers });
}
