import { NextResponse } from 'next/server';
import { prisma } from '@student-score/database';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';

async function getDepartmentUser(session: any) {
  if (!session?.user) return null;
  const userId = (session.user as any).id;
  const user = await prisma.users.findFirst({
    where: { id: userId },
    select: { id: true, role: true, department_id: true },
  });
  if (!user || user.role !== 'DEPARTMENT' || !user.department_id) return null;
  return user;
}

interface ImportRow {
  rowIndex: number;
  student_id?: string;
  full_name: string;
  email: string;
  password: string;
  class_code?: string;
}

interface ImportResult {
  rowIndex: number;
  success: boolean;
  message: string;
  student_id?: string;
  full_name?: string;
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const deptUser = await getDepartmentUser(session);
  if (!deptUser) {
    return NextResponse.json({ message: 'Unauthorized – chỉ role Khoa mới được import' }, { status: 403 });
  }

  try {
    const { rows, classId } = await req.json() as { rows: ImportRow[]; classId?: string };

    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ message: 'Dữ liệu rỗng' }, { status: 400 });
    }

    if (rows.length > 500) {
      return NextResponse.json({ message: 'Tối đa 500 dòng mỗi lần import' }, { status: 400 });
    }

    // Fetch classes belonging to this department
    const deptClasses = await prisma.classes.findMany({
      where: { department_id: deptUser.department_id!, is_active: 1 },
      select: { id: true, code: true, name: true },
    });
    const classByCode = new Map(deptClasses.map(c => [c.code.toUpperCase(), c]));
    const classById = new Map(deptClasses.map(c => [c.id, c]));

    // If a specific classId is provided, verify it belongs to this department
    if (classId && !classById.has(classId)) {
      return NextResponse.json({ message: 'Lớp không thuộc khoa của bạn' }, { status: 403 });
    }

    const activeSemester = await prisma.semesters.findFirst({
      where: { is_active: 1 },
      orderBy: { created_at: 'desc' },
      select: { id: true },
    });

    // Pre-fetch existing emails and student_ids
    const existingEmails = new Set(
      (await prisma.users.findMany({ select: { email: true } })).map(u => u.email.toLowerCase())
    );
    const existingStudentIds = new Set(
      (await prisma.users.findMany({ where: { student_id: { not: null } }, select: { student_id: true } }))
        .map(u => u.student_id!.toLowerCase())
    );

    const results: ImportResult[] = [];
    let successCount = 0;
    let errorCount = 0;
    const batchEmails = new Set<string>();
    const batchStudentIds = new Set<string>();

    for (const row of rows) {
      const idx = row.rowIndex;

      // Validate required fields
      if (!row.full_name?.trim()) {
        results.push({ rowIndex: idx, success: false, message: 'Thiếu họ tên', full_name: row.full_name });
        errorCount++; continue;
      }
      if (!row.email?.trim()) {
        results.push({ rowIndex: idx, success: false, message: 'Thiếu email', full_name: row.full_name });
        errorCount++; continue;
      }
      if (!row.password?.trim()) {
        results.push({ rowIndex: idx, success: false, message: 'Thiếu mật khẩu', full_name: row.full_name });
        errorCount++; continue;
      }

      const emailLower = row.email.trim().toLowerCase();
      if (existingEmails.has(emailLower) || batchEmails.has(emailLower)) {
        results.push({ rowIndex: idx, success: false, message: `Email "${row.email}" đã tồn tại`, full_name: row.full_name });
        errorCount++; continue;
      }

      const studentId = row.student_id?.trim() || null;
      if (studentId) {
        const sidLower = studentId.toLowerCase();
        if (existingStudentIds.has(sidLower) || batchStudentIds.has(sidLower)) {
          results.push({ rowIndex: idx, success: false, message: `MSSV "${studentId}" đã tồn tại`, full_name: row.full_name, student_id: studentId });
          errorCount++; continue;
        }
      }

      // Resolve class: use provided classId, or lookup from row's class_code
      let resolvedClassId = classId || null;
      if (!resolvedClassId && row.class_code?.trim()) {
        const cls = classByCode.get(row.class_code.trim().toUpperCase());
        if (!cls) {
          results.push({ rowIndex: idx, success: false, message: `Lớp "${row.class_code}" không tồn tại hoặc không thuộc khoa`, full_name: row.full_name });
          errorCount++; continue;
        }
        resolvedClassId = cls.id;
      }

      if (!resolvedClassId) {
        results.push({ rowIndex: idx, success: false, message: 'Chưa chỉ định lớp (chọn lớp hoặc thêm cột Lớp trong file)', full_name: row.full_name });
        errorCount++; continue;
      }

      // Create user
      try {
        const passwordHash = await bcrypt.hash(row.password.trim(), 10);
        const userId = randomUUID();

        await prisma.users.create({
          data: {
            id: userId,
            full_name: row.full_name.trim(),
            email: row.email.trim(),
            password_hash: passwordHash,
            student_id: studentId,
            role: 'STUDENT',
            department_id: deptUser.department_id,
            is_active: 1,
          },
        });

        // Create semester enrollment
        if (activeSemester) {
          await prisma.semester_enrollments.create({
            data: {
              id: randomUUID(),
              user_id: userId,
              semester_id: activeSemester.id,
              class_id: resolvedClassId,
              is_active: 1,
            },
          });
        }

        batchEmails.add(emailLower);
        if (studentId) batchStudentIds.add(studentId.toLowerCase());

        results.push({ rowIndex: idx, success: true, message: 'Thành công', full_name: row.full_name, student_id: studentId || undefined });
        successCount++;
      } catch (err: any) {
        results.push({ rowIndex: idx, success: false, message: err?.message || 'Lỗi tạo tài khoản', full_name: row.full_name });
        errorCount++;
      }
    }

    return NextResponse.json({
      message: `Import hoàn tất: ${successCount} thành công, ${errorCount} lỗi`,
      successCount,
      errorCount,
      total: rows.length,
      results,
    });
  } catch (err: any) {
    console.error('Dept bulk import error:', err);
    return NextResponse.json({ message: 'Lỗi server khi import' }, { status: 500 });
  }
}
