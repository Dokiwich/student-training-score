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
      where: { semester_id: null },
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

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!isAdmin(session)) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { name, description } = body;

    if (!name) {
      return NextResponse.json({ message: 'Thiếu tên bộ tiêu chí' }, { status: 400 });
    }

    const { randomUUID } = require('crypto');
    const newVersionId = `tpl_${randomUUID().slice(0, 8)}`;

    const newVersion = await prisma.criteria_versions.create({
      data: {
        id: newVersionId,
        semester_id: null,
        name,
        description,
        version: 1,
        is_active: 1,
        applied_at: null,
      },
    });

    return NextResponse.json({
      message: 'Tạo bộ tiêu chí mẫu thành công',
      data: newVersion,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: 'Lỗi server' }, { status: 500 });
  }
}
