import { NextResponse } from 'next/server';
import { prisma } from '@student-score/database';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { logAdminAction } from '../../../../lib/audit';

async function getDepartmentUser(session: any) {
  if (!session?.user) return null;
  const userId = (session?.user as any)?.id;
  const user = await prisma.users.findFirst({
    where: { id: userId },
    include: { user_roles: { include: { roles: true } } },
  });
  if (!user || !user.user_roles?.some(ur => ur.roles.code === 'DEPARTMENT' && ur.is_active === 1) || !user.department_id) return null;
  return user;
}

/**
 * GET /api/department/users?classId=xxx
 * List students in a class belonging to user's department
 */
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  const deptUser = await getDepartmentUser(session);
  if (!deptUser) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const classId = searchParams.get('classId');

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

  // Get active semester
  const activeSemester = await prisma.semesters.findFirst({
    where: { is_active: 1 },
    orderBy: { created_at: 'desc' },
    select: { id: true },
  });

  if (!activeSemester) {
    return NextResponse.json({ data: [] });
  }

  const enrollments = await prisma.semester_enrollments.findMany({
    select: {
      id: true,
      users: {
        select: {
          id: true,
          student_id: true,
          full_name: true,
          email: true,
          user_roles: { include: { roles: true } },
        },
      },
    },
    where: {
      class_id: classId,
      semester_id: activeSemester.id,
      is_active: 1,
      users: {
        is_active: 1,
        student_id: { not: null },
      },
    },
    orderBy: { users: { full_name: 'asc' } },
  });

  return NextResponse.json({
    data: enrollments.map(e => ({
      enrollmentId: e.id,
      id: e.users.id,
      student_id: e.users.student_id,
      full_name: e.users.full_name,
      email: e.users.email,
      role: e.users.user_roles?.find((ur: any) => ur.is_active === 1)?.roles?.code || 'STUDENT',
    })),
  });
}

/**
 * POST /api/department/users
 * Add a new student to a class in user's department
 */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const deptUser = await getDepartmentUser(session);
  if (!deptUser) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 403 });
  }

  try {
    const { full_name, email, password, student_id, class_id } = await req.json();

    if (!full_name || !email || !password || !class_id) {
      return NextResponse.json({ message: 'Vui lòng nhập đầy đủ: Họ tên, Email, Mật khẩu, Lớp' }, { status: 400 });
    }

    // Verify class belongs to department
    const cls = await prisma.classes.findFirst({
      where: { id: class_id, department_id: deptUser.department_id! },
    });
    if (!cls) {
      return NextResponse.json({ message: 'Lớp không thuộc khoa của bạn' }, { status: 403 });
    }

    // Check duplicate email
    const existingEmail = await prisma.users.findUnique({ where: { email } });
    if (existingEmail) {
      return NextResponse.json({ message: 'Email đã tồn tại' }, { status: 400 });
    }

    // Check duplicate student_id
    if (student_id) {
      const existingSid = await prisma.users.findUnique({ where: { student_id } });
      if (existingSid) {
        return NextResponse.json({ message: 'MSSV đã tồn tại' }, { status: 400 });
      }
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const userId = randomUUID();

    // Create enrollment for active semester
    const activeSemester = await prisma.semesters.findFirst({
      where: { is_active: 1 },
      orderBy: { created_at: 'desc' },
      select: { id: true },
    });

    const newUser = await prisma.$transaction(async (tx) => {
      const user = await tx.users.create({
        data: {
          id: userId,
          full_name,
          email,
          password_hash: passwordHash,
          student_id: student_id || null,
          user_roles: {
            create: {
              id: randomUUID(),
              roles: { connect: { code: 'STUDENT' } },
              is_active: 1
            }
          },
          department_id: deptUser.department_id,
          is_active: 1,
        },
      });

      if (activeSemester) {
        await tx.semester_enrollments.create({
          data: {
            id: randomUUID(),
            user_id: userId,
            semester_id: activeSemester.id,
            class_id,
            is_active: 1,
          },
        });
      }
      return user;
    });

    const actorId = deptUser.id;
    await logAdminAction(actorId, 'CREATE_USER_ENROLLMENT', 'users', userId, null, { ...newUser, password_hash: '***' });

    return NextResponse.json({ message: 'Thêm sinh viên thành công' });
  } catch (err: any) {
    console.error('Dept add user error:', err);
    return NextResponse.json({ message: 'Lỗi server' }, { status: 500 });
  }
}

/**
 * DELETE /api/department/users
 * Remove a student's enrollment from a class (does NOT delete the user account)
 */
export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  const deptUser = await getDepartmentUser(session);
  if (!deptUser) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 403 });
  }

  try {
    const { enrollmentId } = await req.json();
    if (!enrollmentId) {
      return NextResponse.json({ message: 'enrollmentId là bắt buộc' }, { status: 400 });
    }

    // Verify enrollment is in a class belonging to this department
    const enrollment = await prisma.semester_enrollments.findUnique({
      where: { id: enrollmentId },
      include: { classes: { select: { department_id: true } } },
    });

    if (!enrollment || enrollment.classes.department_id !== deptUser.department_id) {
      return NextResponse.json({ message: 'Không có quyền xóa sinh viên này' }, { status: 403 });
    }

    // Check if student has scoring sheet data
    const sheet = await prisma.scoring_sheets.findFirst({
      where: { enrollment_id: enrollmentId },
    });

    if (sheet) {
      return NextResponse.json({
        message: 'Sinh viên này đã có phiếu chấm điểm. Không thể xóa khỏi lớp. Vui lòng liên hệ Admin.',
      }, { status: 400 });
    }

    const oldEnrollment = await prisma.semester_enrollments.findUnique({ where: { id: enrollmentId } });
    await prisma.semester_enrollments.delete({ where: { id: enrollmentId } });

    const actorId = deptUser.id;
    await logAdminAction(actorId, 'DELETE_USER_ENROLLMENT', 'semester_enrollments', enrollmentId, oldEnrollment, null);

    return NextResponse.json({ message: 'Đã xóa sinh viên khỏi lớp' });
  } catch (err: any) {
    console.error('Dept delete enrollment error:', err);
    return NextResponse.json({ message: 'Lỗi server' }, { status: 500 });
  }
}
