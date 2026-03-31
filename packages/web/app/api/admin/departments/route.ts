// packages/web/app/api/admin/departments/route.ts
import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user || !['SCHOOL_ADMIN', 'SUPER_ADMIN'].includes((session.user as { role?: string }).role || '')) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 403 });
  }
  
  const depts = await prisma.departments.findMany({
    orderBy: { created_at: 'desc' },
  });
  return NextResponse.json({ data: depts });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !['SCHOOL_ADMIN', 'SUPER_ADMIN'].includes((session.user as { role?: string }).role || '')) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 403 });
  }

  try {
    const { code, name } = await req.json();
    if (!code || !name) return NextResponse.json({ message: 'Thiếu thông tin' }, { status: 400 });

    const newDept = await prisma.departments.create({
      data: {
        id: randomUUID(),
        code,
        name,
        is_active: 1,
      },
    });
    return NextResponse.json({ message: 'Đã thêm thành công', data: newDept });
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'code' in err && err.code === 'P2002') return NextResponse.json({ message: 'Mã phòng khoa đã tồn tại' }, { status: 400 });
    return NextResponse.json({ message: 'Lỗi server' }, { status: 500 });
  }
}
