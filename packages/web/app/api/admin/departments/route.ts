// packages/web/app/api/admin/departments/route.ts
import { auth } from '@/auth';
import { NextResponse } from 'next/server';
import { prisma } from '@student-score/database';
import { randomUUID } from 'crypto';
import { logAdminAction } from '../../../../lib/audit';

function isAdmin(session: any): boolean {
  return session?.user && (session.user as { role?: string }).role === 'SCHOOL_ADMIN';
}

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await auth();
  if (!isAdmin(session)) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 403 });
  }

  const depts = await prisma.departments.findMany({
    orderBy: { created_at: 'asc' },
    include: {
      _count: { select: { classes: true, users: true } },
    },
  });
  return NextResponse.json({
    data: depts.map((d) => ({
      id: d.id,
      code: d.code,
      name: d.name,
      is_active: d.is_active,
      created_at: d.created_at,
      classCount: d._count.classes,
      userCount: d._count.users,
    })),
  });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!isAdmin(session)) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 403 });
  }

  try {
    const { code, name } = await req.json();
    if (!code || !name) return NextResponse.json({ message: 'Mã và tên khoa là bắt buộc' }, { status: 400 });

    const existing = await prisma.departments.findFirst({
      where: { OR: [{ code }, { name }] },
    });
    if (existing) {
      return NextResponse.json({ message: 'Mã hoặc tên khoa đã tồn tại' }, { status: 400 });
    }

    const newDept = await prisma.departments.create({
      data: {
        id: randomUUID(),
        code,
        name,
        is_active: 1,
      },
    });

    const actorId = (session?.user as any)?.id;
    await logAdminAction(actorId, 'CREATE_DEPARTMENT', 'departments', newDept.id, null, newDept);

    return NextResponse.json({ message: 'Tạo khoa thành công', data: newDept });
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'code' in err && err.code === 'P2002')
      return NextResponse.json({ message: 'Mã khoa đã tồn tại' }, { status: 400 });
    return NextResponse.json({ message: 'Lỗi server' }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  const session = await auth();
  if (!isAdmin(session)) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 403 });
  }

  try {
    const { id, code, name, is_active } = await req.json();
    if (!id) return NextResponse.json({ message: 'ID khoa là bắt buộc' }, { status: 400 });

    // Check duplicate name (exclude self)
    if (name) {
      const dup = await prisma.departments.findFirst({
        where: { name, id: { not: id } },
      });
      if (dup) {
        return NextResponse.json({ message: 'Tên khoa đã tồn tại' }, { status: 400 });
      }
    }

    const oldDept = await prisma.departments.findUnique({ where: { id } });
    if (!oldDept) return NextResponse.json({ message: 'Không tìm thấy khoa' }, { status: 404 });

    const updateData: Record<string, unknown> = {};
    if (code !== undefined) updateData.code = code;
    if (name !== undefined) updateData.name = name;
    if (is_active !== undefined) updateData.is_active = is_active;

    const dept = await prisma.departments.update({
      where: { id },
      data: updateData,
    });

    const actorId = (session?.user as any)?.id;
    await logAdminAction(actorId, 'UPDATE_DEPARTMENT', 'departments', id, oldDept, dept);

    return NextResponse.json({ message: 'Cập nhật khoa thành công', data: dept });
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'code' in err && err.code === 'P2002')
      return NextResponse.json({ message: 'Mã khoa đã tồn tại' }, { status: 400 });
    return NextResponse.json({ message: 'Lỗi server' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const session = await auth();
  if (!isAdmin(session)) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 403 });
  }

  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ message: 'ID khoa là bắt buộc' }, { status: 400 });

    // Check if has classes — prevent cascade delete
    const classCount = await prisma.classes.count({
      where: { department_id: id },
    });
    if (classCount > 0) {
      return NextResponse.json(
        { message: `Không thể xóa: Khoa này còn ${classCount} lớp. Cần xoá hoặc chuyển lớp trước.` },
        { status: 400 }
      );
    }

    const oldDept = await prisma.departments.findUnique({ where: { id } });
    if (!oldDept) return NextResponse.json({ message: 'Không tìm thấy khoa' }, { status: 404 });

    await prisma.departments.delete({ where: { id } });

    const actorId = (session?.user as any)?.id;
    await logAdminAction(actorId, 'DELETE_DEPARTMENT', 'departments', id, oldDept, null);

    return NextResponse.json({ message: 'Xóa khoa thành công' });
  } catch (e) {
    return NextResponse.json({ message: 'Lỗi server' }, { status: 500 });
  }
}
