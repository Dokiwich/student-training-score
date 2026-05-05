import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';

const prisma = new PrismaClient();

function isAdmin(session: any): boolean {
  return session?.user && (session.user as { role?: string }).role === 'SCHOOL_ADMIN';
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!isAdmin(session)) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const role = searchParams.get('role');
  const classId = searchParams.get('classId');
  const departmentId = searchParams.get('departmentId');

  const where: Record<string, unknown> = {};
  if (role) where.role = role;
  if (classId) where.class_id = classId;
  if (departmentId) where.department_id = departmentId;

  const users = await prisma.users.findMany({
    where,
    orderBy: { created_at: 'asc' },
    select: {
      id: true,
      student_id: true,
      email: true,
      full_name: true,
      phone: true,
      role: true,
      department_id: true,
      class_id: true,
      is_active: true,
      created_at: true,
      last_login_at: true,
      classes: { select: { id: true, name: true, code: true } },
      departments: { select: { id: true, name: true, code: true } },
    },
    take: 500,
  });

  return NextResponse.json({
    data: users.map((u) => ({
      id: u.id,
      student_id: u.student_id,
      email: u.email,
      full_name: u.full_name,
      phone: u.phone,
      role: u.role,
      department_id: u.department_id,
      class_id: u.class_id,
      className: u.classes?.name || '',
      classCode: u.classes?.code || '',
      departmentName: u.departments?.name || '',
      departmentCode: u.departments?.code || '',
      is_active: u.is_active,
      created_at: u.created_at,
      last_login_at: u.last_login_at,
    })),
  });
}

import bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!isAdmin(session)) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { full_name, email, password, student_id, role, department_id, class_id } = body;

    if (!full_name || !email || !password || !role) {
      return NextResponse.json({ message: 'Vui lòng nhập đầy đủ các trường bắt buộc' }, { status: 400 });
    }

    const existingUser = await prisma.users.findUnique({ where: { email } });
    if (existingUser) {
      return NextResponse.json({ message: 'Email đã tồn tại' }, { status: 400 });
    }
    
    if (student_id) {
      const existingStudentId = await prisma.users.findUnique({ where: { student_id } });
      if (existingStudentId) {
        return NextResponse.json({ message: 'Mã số sinh viên đã tồn tại' }, { status: 400 });
      }
    }

    const password_hash = await bcrypt.hash(password, 10);
    const newUser = await prisma.users.create({
      data: {
        id: randomUUID(),
        full_name,
        email,
        password_hash,
        student_id: student_id || null,
        role,
        department_id: department_id || null,
        class_id: class_id || null,
        is_active: 1
      }
    });

    return NextResponse.json({ message: 'Thêm tài khoản thành công', data: { id: newUser.id } });
  } catch (err: any) {
    console.error('Add user error:', err);
    return NextResponse.json({ message: 'Lỗi server khi thêm tài khoản' }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  const session = await getServerSession(authOptions);
  if (!isAdmin(session)) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 403 });
  }

  try {
    const { id, role, class_id, department_id, is_active, full_name, phone } = await req.json();
    if (!id) return NextResponse.json({ message: 'ID người dùng là bắt buộc' }, { status: 400 });

    const updateData: Record<string, unknown> = {};
    if (role !== undefined) updateData.role = role;
    if (class_id !== undefined) updateData.class_id = class_id || null;
    if (department_id !== undefined) updateData.department_id = department_id || null;
    if (is_active !== undefined) updateData.is_active = is_active;
    if (full_name !== undefined) updateData.full_name = full_name;
    if (phone !== undefined) updateData.phone = phone;

    const user = await prisma.users.update({
      where: { id },
      data: updateData,
    });
    return NextResponse.json({ message: 'Cập nhật người dùng thành công', data: user });
  } catch {
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
    if (!id) return NextResponse.json({ message: 'ID người dùng là bắt buộc' }, { status: 400 });

    // Cascade delete all related data in a transaction
    await prisma.$transaction(async (tx) => {
      // 1. Tìm tất cả scoring_sheets của user
      const sheets = await tx.scoring_sheets.findMany({
        where: { student_id: id },
        select: { id: true },
      });
      const sheetIds = sheets.map((s) => s.id);

      if (sheetIds.length > 0) {
        // 2. Xóa score_adjustment_logs liên quan đến score_details
        const scoreDetails = await tx.score_details.findMany({
          where: { scoring_sheet_id: { in: sheetIds } },
          select: { id: true },
        });
        const detailIds = scoreDetails.map((d) => d.id);
        if (detailIds.length > 0) {
          await tx.score_adjustment_logs.deleteMany({ where: { score_detail_id: { in: detailIds } } });
        }

        // 3. Xóa score_details
        await tx.score_details.deleteMany({ where: { scoring_sheet_id: { in: sheetIds } } });

        // 4. Xóa các bảng phụ khác liên quan scoring_sheets
        await tx.review_actions.deleteMany({ where: { scoring_sheet_id: { in: sheetIds } } });
        await tx.comments.deleteMany({ where: { scoring_sheet_id: { in: sheetIds } } });
        await tx.evidences.deleteMany({ where: { scoring_sheet_id: { in: sheetIds } } });
        await tx.appeals.deleteMany({ where: { scoring_sheet_id: { in: sheetIds } } });

        // 5. Xóa scoring_sheets
        await tx.scoring_sheets.deleteMany({ where: { id: { in: sheetIds } } });
      }

      // 6. Xóa class_roles, refresh_tokens, notifications
      await tx.class_roles.deleteMany({ where: { user_id: id } });
      await tx.refresh_tokens.deleteMany({ where: { user_id: id } });
      await tx.notifications.deleteMany({ where: { user_id: id } });
      
      // 7. Xóa review_actions nơi user là reviewer
      await tx.review_actions.deleteMany({ where: { reviewer_id: id } });
      
      // 8. Xóa score_adjustment_logs nơi user là người điều chỉnh
      await tx.score_adjustment_logs.deleteMany({ where: { adjusted_by_id: id } });

      // 9. Cuối cùng, xóa user
      await tx.users.delete({ where: { id } });
    });

    return NextResponse.json({ message: 'Xóa người dùng thành công' });
  } catch (err: any) {
    console.error('Delete user error:', err);
    return NextResponse.json(
      { message: err?.message || 'Lỗi khi xóa người dùng. Có thể còn dữ liệu liên quan chưa được xóa.' },
      { status: 500 }
    );
  }
}
