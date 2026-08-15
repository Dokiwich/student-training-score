import { auth } from '@/auth';
import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(req.url);
  const studentId = url.searchParams.get('studentId') || '';
  const sheetId = url.searchParams.get('sheetId') || '';
  const semesterId = url.searchParams.get('semesterId') || '';

  try {
    const backendUrl = new URL(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'}/scoring/progress`);
    if (studentId) backendUrl.searchParams.set('studentId', studentId);
    if (sheetId) backendUrl.searchParams.set('sheetId', sheetId);
    if (semesterId) backendUrl.searchParams.set('semesterId', semesterId);

    const response = await fetch(backendUrl.toString(), {
      headers: {
        Authorization: `Bearer ${(session as any).customJwt}`,
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Error proxying to /scoring/progress:', error);
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}
