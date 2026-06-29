import { NextResponse } from 'next/server';
import { prisma } from '@student-score/database';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';

function isAdmin(session: any): boolean {
  return session?.user && (session.user as { role?: string }).role === 'SCHOOL_ADMIN';
}

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!isAdmin(session)) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 403 });
  }

  try {
    const versions = await prisma.criteria_versions.findMany({
      include: { semesters: { select: { name: true, code: true, academic_year: true } } },
      orderBy: { created_at: 'desc' },
    });

    return NextResponse.json({
      message: 'Thành công',
      data: versions,
    });
  } catch (err) {
    return NextResponse.json({ message: 'Lỗi server' }, { status: 500 });
  }
}
