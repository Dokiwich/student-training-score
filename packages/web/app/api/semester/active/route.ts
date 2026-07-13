import { NextResponse } from 'next/server';
import { prisma } from '@student-score/database';

export const dynamic = 'force-dynamic';

/**
 * Tính trạng thái học kỳ theo thời gian thực dựa trên ngày hiện tại và các deadline.
 *
 * Timeline: start_date → student_deadline → class_committee_deadline
 *           → advisor_deadline → school_deadline → end_date
 *
 * - Trước start_date         → UPCOMING
 * - start_date ≤ now < student_deadline → STUDENT_SCORING
 * - student_deadline ≤ now < class_committee_deadline → CLASS_REVIEWING
 * - class_committee_deadline ≤ now < advisor_deadline → ADVISOR_REVIEWING
 * - advisor_deadline ≤ now < school_deadline → SCHOOL_REVIEWING
 * - school_deadline ≤ now ≤ end_date → FINALIZED
 * - Sau end_date             → LOCKED
 */
function computeStatus(semester: {
  start_date: Date;
  end_date: Date;
  student_deadline: Date;
  class_committee_deadline: Date;
  advisor_deadline: Date;
  school_deadline: Date;
}): string {
  const now = new Date();

  if (now < new Date(semester.start_date)) return 'UPCOMING';
  if (now < new Date(semester.student_deadline)) return 'STUDENT_SCORING';
  if (now < new Date(semester.class_committee_deadline)) return 'CLASS_REVIEWING';
  if (now < new Date(semester.advisor_deadline)) return 'ADVISOR_REVIEWING';
  if (now < new Date(semester.school_deadline)) return 'SCHOOL_REVIEWING';
  if (now <= new Date(semester.end_date)) return 'FINALIZED';
  return 'LOCKED';
}

const SEMESTER_SELECT = {
  id: true,
  code: true,
  name: true,
  academic_year: true,
  status: true,
  start_date: true,
  end_date: true,
  student_deadline: true,
  class_committee_deadline: true,
  advisor_deadline: true,
  school_deadline: true,
} as const;

let cachedSemester: any = null;
let cacheExpires = 0;

// Public endpoint — không cần auth, mọi role đều đọc được
// Trả về học kỳ đang active (is_active = 1) hoặc học kỳ gần nhất
export async function GET() {
  try {
    const now = Date.now();
    if (cachedSemester && cacheExpires > now) {
      return NextResponse.json({ data: cachedSemester }, {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
          'Pragma': 'no-cache',
        },
      });
    }

    // Ưu tiên học kỳ đang active
    let semester = await prisma.semesters.findFirst({
      where: { is_active: 1 },
      orderBy: { start_date: 'desc' },
      select: SEMESTER_SELECT,
    });

    // Fallback: học kỳ bắt đầu gần nhất
    if (!semester) {
      semester = await prisma.semesters.findFirst({
        orderBy: { start_date: 'desc' },
        select: SEMESTER_SELECT,
      });
    }

    if (!semester) {
      return NextResponse.json({ data: null }, {
        headers: { 'Cache-Control': 'no-store' },
      });
    }

    // ── Auto-compute trạng thái theo thời gian thực ──
    const computed = computeStatus(semester);
    if (computed !== semester.status) {
      semester = { ...semester, status: computed as any };
    }

    cachedSemester = semester;
    cacheExpires = now + 60000; // cache 60s

    return NextResponse.json({ data: semester }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Pragma': 'no-cache',
      },
    });
  } catch (e) {
    return NextResponse.json({ data: null }, { status: 500 });
  }
}
