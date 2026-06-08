import { NextResponse } from 'next/server';
import { prisma } from '@student-score/database';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { randomUUID } from 'crypto';

function isAdmin(session: any): boolean {
  return session?.user && (session.user as { role?: string }).role === 'SCHOOL_ADMIN';
}

/** Tính trạng thái học kỳ theo thời gian thực */
function computeStatus(s: {
  start_date: Date;
  end_date: Date;
  student_deadline: Date;
  class_committee_deadline: Date;
  advisor_deadline: Date;
  school_deadline: Date;
}): string {
  const now = new Date();
  if (now < new Date(s.start_date)) return 'UPCOMING';
  if (now < new Date(s.student_deadline)) return 'STUDENT_SCORING';
  if (now < new Date(s.class_committee_deadline)) return 'CLASS_REVIEWING';
  if (now < new Date(s.advisor_deadline)) return 'ADVISOR_REVIEWING';
  if (now < new Date(s.school_deadline)) return 'SCHOOL_REVIEWING';
  if (now <= new Date(s.end_date)) return 'FINALIZED';
  return 'LOCKED';
}

export async function GET() {
  const session = await getServerSession(authOptions);
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

  // Auto-compute & sync status cho tất cả HK
  const updated = await Promise.all(semesters.map(async (s) => {
    const computed = computeStatus(s);
    const shouldDeactivate = computed === 'LOCKED' && s.is_active === 1;
    
    if (computed !== s.status || shouldDeactivate) {
      await prisma.semesters.update({
        where: { id: s.id },
        data: { 
          status: computed as any,
          ...(shouldDeactivate ? { is_active: 0 } : {})
        },
      });
    }

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
  }));

  return NextResponse.json({ data: updated });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!isAdmin(session)) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 403 });
  }

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

    const semester = await prisma.semesters.create({
      data: {
        id: randomUUID(),
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

    return NextResponse.json({ message: 'Tạo học kỳ thành công', data: semester });
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'code' in err && err.code === 'P2002')
      return NextResponse.json({ message: 'Mã học kỳ đã tồn tại' }, { status: 400 });
    return NextResponse.json({ message: 'Lỗi server' }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  const session = await getServerSession(authOptions);
  if (!isAdmin(session)) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 403 });
  }

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
        updateData[key] = new Date(val);
      } else {
        updateData[key] = val;
      }
    }

    const semester = await prisma.semesters.update({
      where: { id },
      data: updateData,
    });
    return NextResponse.json({ message: 'Cập nhật học kỳ thành công', data: semester });
  } catch {
    return NextResponse.json({ message: 'Lỗi server' }, { status: 500 });
  }
}

/** PATCH — Kích hoạt một học kỳ (set is_active=1, tắt tất cả HK khác) */
export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!isAdmin(session)) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { id } = body;
    if (!id) return NextResponse.json({ message: 'ID học kỳ là bắt buộc' }, { status: 400 });

    const targetSemester = await prisma.semesters.findUnique({ where: { id } });
    if (!targetSemester) return NextResponse.json({ message: 'Không tìm thấy học kỳ' }, { status: 404 });
    if (targetSemester.status === 'LOCKED') {
      return NextResponse.json({ message: 'Không thể kích hoạt học kỳ đã Khóa' }, { status: 400 });
    }

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

    return NextResponse.json({ message: 'Đã kích hoạt học kỳ thành công' });
  } catch {
    return NextResponse.json({ message: 'Lỗi server' }, { status: 500 });
  }
}
