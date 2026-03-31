import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET() {
  const cookieStore = await cookies();
  return NextResponse.json({
    cookieHeader: cookieStore.getAll().map(c => `${c.name}=${c.value}`).join('; '),
    all: cookieStore.getAll()
  });
}
