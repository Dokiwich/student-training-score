import { NextResponse } from 'next/server';
import { prisma } from '@student-score/database';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { randomUUID } from 'crypto';

async function getDepartmentUser(session: any) {
  if (!session?.user) return null;
  const userId = (session.user as any).id;
  const user = await prisma.users.findFirst({
    where: { id: userId },
    include: { user_roles: { include: { roles: true } } },
  });
  if (!user || !user.user_roles?.some(ur => ur.roles.code === 'DEPARTMENT' && ur.is_active === 1) || !user.department_id) return null;
  return user;
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  const deptUser = await getDepartmentUser(session);
  if (!deptUser) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 403 });
  }

  const classes = await prisma.classes.findMany({
    where: { department_id: deptUser.department_id!, is_active: 1 },
    orderBy: { code: 'asc' },
    select: {
      id: true,
      code: true,
      name: true,
      academic_year: true,
      _count: { select: { semester_enrollments: true } },
    },
  });

  return NextResponse.json({
    data: classes.map(c => ({
      id: c.id,
      code: c.code,
      name: c.name,
      academicYear: c.academic_year,
      studentCount: c._count.semester_enrollments,
    })),
  });
}

/**
 * POST /api/department/classes
 * Thêm lớp mới thuộc khoa
 */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const deptUser = await getDepartmentUser(session);
  if (!deptUser) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 403 });
  }

  try {
    const { code, name, academic_year } = await req.json();

    if (!code?.trim() || !name?.trim()) {
      return NextResponse.json({ message: 'Mã lớp và Tên lớp là bắt buộc' }, { status: 400 });
    }

    // Check duplicate code
    const existing = await prisma.classes.findUnique({ where: { code: code.trim() } });
    if (existing) {
      return NextResponse.json({ message: `Mã lớp "${code}" đã tồn tại` }, { status: 400 });
    }

    const cls = await prisma.classes.create({
      data: {
        id: randomUUID(),
        code: code.trim(),
        name: name.trim(),
        department_id: deptUser.department_id!,
        academic_year: academic_year?.trim() || new Date().getFullYear().toString(),
        is_active: 1,
      },
    });

    return NextResponse.json({ message: 'Thêm lớp thành công', data: cls });
  } catch (err: any) {
    console.error('Dept add class error:', err);
    if (err?.code === 'P2002') {
      return NextResponse.json({ message: 'Mã lớp đã tồn tại' }, { status: 400 });
    }
    return NextResponse.json({ message: 'Lỗi server' }, { status: 500 });
  }
}

/**
 * PUT /api/department/classes
 * Sửa thông tin lớp học
 */
export async function PUT(req: Request) {
  const session = await getServerSession(authOptions);
  const deptUser = await getDepartmentUser(session);
  if (!deptUser) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 403 });
  }

  try {
    const { id, code, name, academic_year } = await req.json();

    if (!id || !code?.trim() || !name?.trim()) {
      return NextResponse.json({ message: 'ID, Mã lớp và Tên lớp là bắt buộc' }, { status: 400 });
    }

    // Verify class belongs to this department
    const cls = await prisma.classes.findFirst({
      where: { id, department_id: deptUser.department_id! },
    });
    if (!cls) {
      return NextResponse.json({ message: 'Lớp không thuộc khoa của bạn' }, { status: 403 });
    }

    // Check duplicate code (if code changed)
    if (code.trim() !== cls.code) {
      const existing = await prisma.classes.findUnique({ where: { code: code.trim() } });
      if (existing) {
        return NextResponse.json({ message: `Mã lớp "${code}" đã tồn tại` }, { status: 400 });
      }
    }

    const updatedCls = await prisma.classes.update({
      where: { id },
      data: {
        code: code.trim(),
        name: name.trim(),
        academic_year: academic_year?.trim() || cls.academic_year,
      },
    });

    return NextResponse.json({ message: 'Cập nhật lớp thành công', data: updatedCls });
  } catch (err: any) {
    console.error('Dept edit class error:', err);
    if (err?.code === 'P2002') {
      return NextResponse.json({ message: 'Mã lớp đã tồn tại' }, { status: 400 });
    }
    return NextResponse.json({ message: 'Lỗi server' }, { status: 500 });
  }
}

/**
 * DELETE /api/department/classes
 * Xóa (soft-delete) lớp — chỉ cho phép nếu lớp chưa có sinh viên nào enrolled
 */
export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  const deptUser = await getDepartmentUser(session);
  if (!deptUser) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 403 });
  }

  try {
    const { classId } = await req.json();
    if (!classId) {
      return NextResponse.json({ message: 'classId là bắt buộc' }, { status: 400 });
    }

    // Verify class belongs to this department
    const cls = await prisma.classes.findFirst({
      where: { id: classId, department_id: deptUser.department_id! },
    });
    if (!cls) {
      return NextResponse.json({ message: 'Lớp không thuộc khoa của bạn' }, { status: 403 });
    }

    // Check if class has any enrollments
    const enrollmentCount = await prisma.semester_enrollments.count({
      where: { class_id: classId },
    });
    if (enrollmentCount > 0) {
      return NextResponse.json({
        message: `Lớp "${cls.code}" đang có ${enrollmentCount} sinh viên. Vui lòng xóa hết sinh viên trước khi xóa lớp.`,
      }, { status: 400 });
    }

    // Soft-delete
    await prisma.classes.update({
      where: { id: classId },
      data: { is_active: 0 },
    });

    return NextResponse.json({ message: `Đã xóa lớp "${cls.code}"` });
  } catch (err: any) {
    console.error('Dept delete class error:', err);
    return NextResponse.json({ message: 'Lỗi server' }, { status: 500 });
  }
}
