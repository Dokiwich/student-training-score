import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const BACKEND_URL = 'http://127.0.0.1:3000';

/**
 * Forward a request from the browser to the NestJS backend,
 * attaching the browser's cookies so `getToken()` on the backend
 * can read the next-auth.session-token.
 */
export async function proxyToBackend(
  backendPath: string,
  req: NextRequest,
  options?: { method?: string; body?: string }
) {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join('; ');

  const method = options?.method || req.method;

  const headers: Record<string, string> = {
    'Cookie': cookieHeader,
  };

  if (options?.body) {
    headers['Content-Type'] = 'application/json';
  }

  const url = `${BACKEND_URL}${backendPath}`;

  try {
    const backendRes = await fetch(url, {
      method,
      headers,
      body: options?.body || undefined,
    });

    const data = await backendRes.text();

    return new NextResponse(data, {
      status: backendRes.status,
      headers: { 'Content-Type': backendRes.headers.get('Content-Type') || 'application/json' },
    });
  } catch (error) {
    console.error('Proxy error:', error);
    return NextResponse.json(
      { message: 'Không thể kết nối tới máy chủ Backend' },
      { status: 502 }
    );
  }
}
