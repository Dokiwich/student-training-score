import { auth } from '@/auth';
import { NextResponse } from 'next/server';
import { prisma } from '@student-score/database';
import { randomUUID } from 'crypto';
import { logAdminAction } from '../../../../lib/audit';

function isAdmin(session: any): boolean {
  return session?.user && (session.user as { role?: string }).role === 'SCHOOL_ADMIN';
}

/** Tính trạng thái học kỳ theo thời gian thực tế */
function computeStatus(s: {
  start_date: Date;
  end_date: Date;
  student_deadline: Date | null;
  class_committee_deadline: Date | null;
  advisor_deadline: Date | null;
  school_deadline: Date | null;
}): string {
  const now = new Date();
  const endDate = new Date(s.end_date);
  if (now < new Date(s.start_date)) return 'UPCOMING';
  if (s.student_deadline && now < new Date(s.student_deadline)) return 'STUDENT_SCORING';
  if (s.class_committee_deadline && now < new Date(s.class_committee_deadline)) return 'CLASS_REVIEWING';
  if (s.advisor_deadline && now < new Date(s.advisor_deadline)) return 'ADVISOR_REVIEWING';
  if (s.school_deadline && now < new Date(s.school_deadline)) return 'SCHOOL_REVIEWING';
  if (now <= endDate) return 'FINALIZED';
  return 'LOCKED';
}

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await auth();
  if (!isAdmin(session)) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 403 });
  }

  const semesters = await prisma.semesters.findMany({
    orderBy: { start_date: 'desc' },
    include: {
      criteria_versions: {
        where: { is_active: 1 },
        include: {
          criteria_categories: {
            include: { _count: { select: { criteria: true } } },
          },
        },
      },
    },
  });

  // Tính toán status trên RAM, không ghi DB để tránh N+1 update trong GET
  const updated = semesters.map((s) => {
    const computed = computeStatus(s);
    const shouldDeactivate = computed === 'LOCKED' && s.is_active === 1;

    // Tính tổng criteria cho semester này
    const activeVersion = s.criteria_versions?.[0];
    const criteriaCount = activeVersion
      ? activeVersion.criteria_categories.reduce((a, c) => a + c._count.criteria, 0)
      : 0;
    const categoryCount = activeVersion?.criteria_categories.length || 0;

    // Remove nested data, chỉ trả về count
    const { criteria_versions, ...semesterData } = s;
    return {
      ...semesterData,
      status: (computed !== s.status || shouldDeactivate) ? computed : s.status,
      ...(shouldDeactivate ? { is_active: 0 } : {}),
      criteriaCount,
      categoryCount,
      hasVersion: !!activeVersion,
    };
  });

  return NextResponse.json({ data: updated });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!isAdmin(session)) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 403 });
  }
  const actorId = (session as any)?.user?.id || 'SYSTEM';

  try {
    const body = await req.json();
    const {
      code, name, academic_year, semester_number,
      start_date, end_date,
      student_deadline, class_committee_deadline,
      advisor_deadline, school_deadline,
    } = body;

    if (!code || !name || !academic_year || !start_date || !end_date) {
      return NextResponse.json({ message: 'Thiếu thông tin bắt buộc' }, { status: 400 });
    }

    const dateSequence = [start_date, student_deadline, class_committee_deadline, advisor_deadline, school_deadline, end_date];
    for (let i = 0; i < dateSequence.length - 1; i++) {
      if (dateSequence[i] && dateSequence[i+1] && new Date(dateSequence[i]) > new Date(dateSequence[i+1])) {
        return NextResponse.json({ message: 'Lỗi Dữ Liệu: Thứ tự các mốc thời gian không hợp lệ.' }, { status: 400 });
      }
    }
    const semester = await prisma.semesters.create({
      data: {
        id: `sem_${code}`,
        code,
        name,
        academic_year,
        semester_number: semester_number || 1,
        start_date: new Date(start_date),
        end_date: new Date(end_date),
        student_deadline: new Date(student_deadline || end_date),
        class_committee_deadline: new Date(class_committee_deadline || end_date),
        advisor_deadline: new Date(advisor_deadline || end_date),
        school_deadline: new Date(school_deadline || end_date),
        status: 'UPCOMING',
        is_active: 0,
      },
    });

    await logAdminAction(actorId, 'CREATE_SEMESTER', 'semesters', semester.id, null, semester);

    return NextResponse.json({ message: 'Tạo học kỳ thành công', data: semester });
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'code' in err && err.code === 'P2002')
      return NextResponse.json({ message: 'Mã học kỳ đã tồn tại' }, { status: 400 });
    return NextResponse.json({ message: 'Lỗi server' }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  const session = await auth();
  if (!isAdmin(session)) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 403 });
  }
  const actorId = (session as any)?.user?.id || 'SYSTEM';

  try {
    const body = await req.json();
    const { id, ...updates } = body;
    if (!id) return NextResponse.json({ message: 'ID học kỳ là bắt buộc' }, { status: 400 });

    // Convert date strings to Date objects
    const dateFields = ['start_date', 'end_date', 'student_deadline', 'class_committee_deadline', 'advisor_deadline', 'school_deadline'];
    const updateData: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(updates)) {
      if (val === undefined) continue;
      if (dateFields.includes(key) && typeof val === 'string') {
        if (val.trim()) {
          updateData[key] = new Date(val);
        }
        // Skip empty strings to avoid Invalid Date
      } else {
        updateData[key] = val;
      }
    }

    const currentSemester = await prisma.semesters.findUnique({ where: { id } });
    if (currentSemester) {
      const getD = (key: string) => updateData[key] !== undefined ? updateData[key] : currentSemester[key as keyof typeof currentSemester];
      const dateSequence = [getD('start_date'), getD('student_deadline'), getD('class_committee_deadline'), getD('advisor_deadline'), getD('school_deadline'), getD('end_date')];
      for (let i = 0; i < dateSequence.length - 1; i++) {
        if (dateSequence[i] && dateSequence[i+1] && new Date(dateSequence[i] as any) > new Date(dateSequence[i+1] as any)) {
          return NextResponse.json({ message: 'Lỗi Dữ Liệu: Thứ tự các mốc thời gian không hợp lệ.' }, { status: 400 });
        }
      }
    }

    const oldData = await prisma.semesters.findUnique({ where: { id } });
    const semester = await prisma.semesters.update({
      where: { id },
      data: updateData,
    });
    await logAdminAction(actorId, 'UPDATE_SEMESTER', 'semesters', id, oldData, semester);
    return NextResponse.json({ message: 'Cập nhật học kỳ thành công', data: semester });
  } catch (e) {
    return NextResponse.json({ message: 'Lỗi server' }, { status: 500 });
  }
}

/** PATCH — Kích hoạt một học kỳ (set is_active=1, tắt tất cả HK khác) */
export async function PATCH(req: Request) {
  const session = await auth();
  if (!isAdmin(session)) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 403 });
  }
  const actorId = (session as any)?.user?.id || 'SYSTEM';

  try {
    const body = await req.json();
    const { id, action = 'activate' } = body;
    if (!id) return NextResponse.json({ message: 'ID học kỳ là bắt buộc' }, { status: 400 });

    const targetSemester = await prisma.semesters.findUnique({ where: { id } });
    if (!targetSemester) return NextResponse.json({ message: 'Không tìm thấy học kỳ' }, { status: 404 });
    if (targetSemester.status === 'LOCKED') {
      return NextResponse.json({ message: 'Không thể thay đổi học kỳ đã Khóa' }, { status: 400 });
    }

    if (action === 'deactivate') {
      const updated = await prisma.semesters.update({
        where: { id },
        data: { is_active: 0 },
      });
      await logAdminAction(actorId, 'DEACTIVATE_SEMESTER', 'semesters', id, targetSemester, updated);
      return NextResponse.json({ message: 'Đã hủy kích hoạt học kỳ thành công' });
    } else {
      // Tắt tất cả HK khác → chỉ kích hoạt HK được chọn
      await prisma.$transaction([
        prisma.semesters.updateMany({
          where: { is_active: 1 },
          data: { is_active: 0 },
        }),
        prisma.semesters.update({
          where: { id },
          data: { is_active: 1 },
        }),
      ]);
      const newActive = await prisma.semesters.findUnique({ where: { id } });
      await logAdminAction(actorId, 'ACTIVATE_SEMESTER', 'semesters', id, targetSemester, newActive);
      return NextResponse.json({ message: 'Đã kích hoạt học kỳ thành công' });
    }
  } catch (e) {
    return NextResponse.json({ message: 'Lỗi server' }, { status: 500 });
  }
}
