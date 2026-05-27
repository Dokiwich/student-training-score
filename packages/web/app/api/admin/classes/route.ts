import { NextResponse } from 'next/server';
import { prisma } from '@student-score/database';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { randomUUID } from 'crypto';

function isAdmin(session: any): boolean {
  return session?.user && (session.user as { role?: string }).role === 'SCHOOL_ADMIN';
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!isAdmin(session)) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const departmentId = searchParams.get('departmentId');

  const where: Record<string, unknown> = {};
  if (departmentId) where.department_id = departmentId;

  const classes = await prisma.classes.findMany({
    where,
    orderBy: { created_at: 'asc' },
    include: {
      departments: { select: { id: true, name: true, code: true } },
      _count: { select: { semester_enrollments: true } },
    },
  });

  return NextResponse.json({
    data: classes.map((c: any) => ({
      id: c.id,
      code: c.code,
      name: c.name,
      department_id: c.department_id,
      departmentName: c.departments?.name || '',
      departmentCode: c.departments?.code || '',
      academic_year: c.academic_year,
      is_active: c.is_active,
      created_at: c.created_at,
      studentCount: c._count?.semester_enrollments || 0,
      sheetCount: 0,
    })),
  });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!isAdmin(session)) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 403 });
  }

  try {
    const { code, name, department_id, academic_year } = await req.json();
    if (!code || !name || !department_id) {
      return NextResponse.json({ message: 'Mã, tên lớp và khoa là bắt buộc' }, { status: 400 });
    }

    // Verify department exists
    const dept = await prisma.departments.findUnique({ where: { id: department_id } });
    if (!dept) {
      return NextResponse.json({ message: 'Khoa không tồn tại' }, { status: 400 });
    }

    const newClass = await prisma.classes.create({
      data: {
        id: randomUUID(),
        code,
        name,
        department_id,
        academic_year: academic_year || '2025-2026',
        is_active: 1,
      },
    });
    return NextResponse.json({ message: 'Tạo lớp thành công', data: newClass });
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'code' in err && err.code === 'P2002')
      return NextResponse.json({ message: 'Mã lớp đã tồn tại' }, { status: 400 });
    return NextResponse.json({ message: 'Lỗi server' }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  const session = await getServerSession(authOptions);
  if (!isAdmin(session)) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 403 });
  }

  try {
    const { id, code, name, department_id, academic_year, is_active } = await req.json();
    if (!id) return NextResponse.json({ message: 'ID lớp là bắt buộc' }, { status: 400 });

    const updateData: Record<string, unknown> = {};
    if (code !== undefined) updateData.code = code;
    if (name !== undefined) updateData.name = name;
    if (department_id !== undefined) updateData.department_id = department_id;
    if (academic_year !== undefined) updateData.academic_year = academic_year;
    if (is_active !== undefined) updateData.is_active = is_active;

    const cls = await prisma.classes.update({
      where: { id },
      data: updateData,
    });
    return NextResponse.json({ message: 'Cập nhật lớp thành công', data: cls });
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'code' in err && err.code === 'P2002')
      return NextResponse.json({ message: 'Mã lớp đã tồn tại' }, { status: 400 });
    return NextResponse.json({ message: 'Lỗi server' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  if (!isAdmin(session)) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 403 });
  }

  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ message: 'ID lớp là bắt buộc' }, { status: 400 });

    // Check if has students
    const studentCount = await prisma.semester_enrollments.count({ where: { class_id: id } });
    if (studentCount > 0) {
      return NextResponse.json(
        { message: `Không thể xóa: Lớp này còn ${studentCount} sinh viên. Cần chuyển sinh viên trước.` },
        { status: 400 }
      );
    }

    // Check if has scoring sheets
    const sheetCount = await prisma.scoring_sheets.count({ where: { semester_enrollments: { class_id: id } } });
    if (sheetCount > 0) {
      return NextResponse.json(
        { message: `Không thể xóa: Lớp này có ${sheetCount} phiếu chấm điểm.` },
        { status: 400 }
      );
    }

    // Delete class roles first
    await prisma.class_roles.deleteMany({ where: { class_id: id } });

    await prisma.classes.delete({ where: { id } });
    return NextResponse.json({ message: 'Xóa lớp thành công' });
  } catch {
    return NextResponse.json({ message: 'Lỗi server' }, { status: 500 });
  }
}
