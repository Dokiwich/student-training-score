import { NextResponse } from 'next/server';
// Force recompile
import { getActiveSemester } from '@/lib/semester';

export const dynamic = 'force-dynamic';

let cachedSemester: any = null;
let cacheExpires = 0;

// Public endpoint — không cần auth, mọi role đều đọc được
// Trả về học kỳ đang active (is_active = 1) hoặc học kỳ gần nhất
export async function GET() {
  try {
    const now = Date.now();
    if (cachedSemester && cacheExpires > now) {
      return NextResponse.json({ data: cachedSemester }, {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
          'Pragma': 'no-cache',
        },
      });
    }

    const semester = await getActiveSemester();

    if (!semester) {
      return NextResponse.json({ data: null }, {
        headers: { 'Cache-Control': 'no-store' },
      });
    }

    cachedSemester = semester;
    cacheExpires = now + 60000; // cache 60s

    return NextResponse.json({ data: semester }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Pragma': 'no-cache',
      },
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ data: null }, { status: 500 });
  }
}
