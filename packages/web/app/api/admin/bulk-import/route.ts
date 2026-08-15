import { auth } from '@/auth';
import { NextResponse } from 'next/server';
import { prisma } from '@student-score/database';
import bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { logAdminAction } from '../../../../lib/audit';

function isAdmin(session: any): boolean {
  return session?.user && (session.user as { role?: string }).role === 'SCHOOL_ADMIN';
}

const VALID_ROLES = ['STUDENT', 'CLASS_COMMITTEE', 'ADVISOR', 'DEPARTMENT', 'SCHOOL_ADMIN'];

interface ImportRow {
  rowIndex: number;
  student_id?: string;
  full_name: string;
  email: string;
  password: string;
  role: string;
  department_code?: string;
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
  const session = await auth();
  if (!isAdmin(session)) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 403 });
  }
  const actorId = (session as any)?.user?.id || 'SYSTEM';

  try {
    const { rows } = await req.json() as { rows: ImportRow[] };

    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ message: 'Dữ liệu rỗng' }, { status: 400 });
    }

    // Đã bỏ giới hạn 500 dòng để import toàn bộ file

    // Fetch all departments and classes for lookup
    const [allDepts, allClasses, activeSemester] = await Promise.all([
      prisma.departments.findMany({ select: { id: true, code: true, name: true } }),
      prisma.classes.findMany({ select: { id: true, code: true, name: true, department_id: true } }),
      prisma.semesters.findFirst({
        where: { is_active: 1 },
        orderBy: { created_at: 'desc' },
        select: { id: true },
      }),
    ]);

    const deptByCode = new Map(allDepts.map(d => [d.code.toUpperCase(), d]));
    const deptByName = new Map(allDepts.map(d => [d.name.toUpperCase(), d]));
    const classByCode = new Map(allClasses.map(c => [c.code.toUpperCase(), c]));

    // Pre-fetch existing emails and student_ids to check duplicates
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

    // Track newly added emails/student_ids within this batch
    const batchEmails = new Set<string>();
    const batchStudentIds = new Set<string>();

    for (const row of rows) {
      const idx = row.rowIndex;

      // Validate required fields
      if (!row.full_name?.trim()) {
        results.push({ rowIndex: idx, success: false, message: 'Thiếu họ tên', full_name: row.full_name });
        errorCount++;
        continue;
      }
      if (!row.email?.trim()) {
        results.push({ rowIndex: idx, success: false, message: 'Thiếu email', full_name: row.full_name });
        errorCount++;
        continue;
      }
      if (!row.password?.trim()) {
        results.push({ rowIndex: idx, success: false, message: 'Thiếu mật khẩu', full_name: row.full_name });
        errorCount++;
        continue;
      }

      const normalRole = row.role?.trim().toUpperCase() || 'STUDENT';
      if (!VALID_ROLES.includes(normalRole)) {
        results.push({ rowIndex: idx, success: false, message: `Vai trò "${row.role}" không hợp lệ. Chấp nhận: ${VALID_ROLES.join(', ')}`, full_name: row.full_name });
        errorCount++;
        continue;
      }
      
      // CLASS_COMMITTEE in UI maps to MONITOR in DB
      const dbRoleCode = normalRole === 'CLASS_COMMITTEE' ? 'MONITOR' : normalRole;

      const emailLower = row.email.trim().toLowerCase();
      if (existingEmails.has(emailLower) || batchEmails.has(emailLower)) {
        results.push({ rowIndex: idx, success: false, message: `Email "${row.email}" đã tồn tại`, full_name: row.full_name });
        errorCount++;
        continue;
      }

      const studentId = row.student_id?.trim() || null;
      if (studentId) {
        const sidLower = studentId.toLowerCase();
        if (existingStudentIds.has(sidLower) || batchStudentIds.has(sidLower)) {
          results.push({ rowIndex: idx, success: false, message: `MSSV "${studentId}" đã tồn tại`, full_name: row.full_name, student_id: studentId });
          errorCount++;
          continue;
        }
      }

      // Resolve department
      let departmentId: string | null = null;
      if (row.department_code?.trim()) {
        const dKey = row.department_code.trim().toUpperCase();
        const dept = deptByCode.get(dKey) || deptByName.get(dKey);
        if (!dept) {
          results.push({ rowIndex: idx, success: false, message: `Không tìm thấy khoa "${row.department_code}"`, full_name: row.full_name });
          errorCount++;
          continue;
        }
        departmentId = dept.id;
      }

      // Resolve class
      let classId: string | null = null;
      if (row.class_code?.trim()) {
        const cls = classByCode.get(row.class_code.trim().toUpperCase());
        if (!cls) {
          results.push({ rowIndex: idx, success: false, message: `Không tìm thấy lớp "${row.class_code}"`, full_name: row.full_name });
          errorCount++;
          continue;
        }
        classId = cls.id;
        // Auto-set department from class if not specified
        if (!departmentId && cls.department_id) {
          departmentId = cls.department_id;
        }
      }

      // Create user
      try {
        const passwordHash = await bcrypt.hash(row.password.trim(), 10);
        const userId = randomUUID();

        await prisma.$transaction(async (tx) => {
          await tx.users.create({
            data: {
              id: userId,
              full_name: row.full_name.trim(),
              email: row.email.trim(),
              password_hash: passwordHash,
              student_id: studentId,
              user_roles: {
                create: {
                  id: randomUUID(),
                  roles: { connect: { code: dbRoleCode } },
                  is_active: 1
                }
              },
              department_id: departmentId,
              is_active: 1,
            },
          });

          // Create semester enrollment if class + active semester
          if (classId && activeSemester) {
            await tx.semester_enrollments.create({
              data: {
                id: randomUUID(),
                user_id: userId,
                semester_id: activeSemester.id,
                class_id: classId,
                is_active: 1,
              },
            });
          }
        });

        batchEmails.add(emailLower);
        if (studentId) batchStudentIds.add(studentId.toLowerCase());

        await logAdminAction(
          actorId,
          'CREATE_USER_BULK',
          'users',
          userId,
          null,
          { email: row.email, student_id: studentId, role: normalRole, department_id: departmentId, class_id: classId }
        );

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
    console.error('Bulk import error:', err);
    return NextResponse.json({ message: 'Lỗi server khi import' }, { status: 500 });
  }
}
