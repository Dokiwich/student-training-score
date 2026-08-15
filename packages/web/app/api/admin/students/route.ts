import { auth } from '@/auth';
import { NextResponse } from 'next/server';
import { prisma } from '@student-score/database';
function isAdmin(session: any): boolean {
  return session?.user && (session.user as { role?: string }).role === 'SCHOOL_ADMIN';
}

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const session = await auth();
  if (!isAdmin(session)) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const semesterId = searchParams.get('semesterId');
  const classId = searchParams.get('classId');

  let semester;
  if (semesterId) {
    semester = await prisma.semesters.findUnique({ where: { id: semesterId } });
  } else {
    semester = await prisma.semesters.findFirst({ where: { is_active: 1 }, orderBy: { created_at: 'desc' } });
  }

  if (!semester) {
    return NextResponse.json({ data: [] });
  }

  const enrollments = await prisma.semester_enrollments.findMany({
    where: { 
      semester_id: semester.id,
      ...(classId ? { class_id: classId } : {}),
      users: {
        is_active: 1,
        student_id: { not: null },
      },
    },
    include: {
      users: true,
      classes: {
        include: { departments: true }
      },
      scoring_sheets: {
        include: {
          score_details: {
            select: {
              score_entries: { select: { scorer_role: true, score: true } },
            },
          },
        },
      }
    }
  });

  const students = enrollments.map(e => {
    const sheet = e.scoring_sheets;
    // ✅ 3NF: Compute totals at runtime
    let studentTotal: number | null = null;
    let classTotal: number | null = null;
    let advisorTotal: number | null = null;
    let finalTotal: number | null = null;
    let classification: string | null = null;
    if (sheet && sheet.score_details) {
      let sSum = 0, cSum = 0, aSum = 0;
      for (const d of sheet.score_details) {
        const entries = d.score_entries || [];
        const sEntry = entries.find((x: any) => x.scorer_role === 'STUDENT');
        const cEntry = entries.find((x: any) => x.scorer_role === 'CLASS_COMMITTEE');
        const aEntry = entries.find((x: any) => x.scorer_role === 'ADVISOR');
        sSum += sEntry ? Number(sEntry.score) : 0;
        cSum += cEntry ? Number(cEntry.score) : (sEntry ? Number(sEntry.score) : 0);
        aSum += aEntry ? Number(aEntry.score) : (cEntry ? Number(cEntry.score) : (sEntry ? Number(sEntry.score) : 0));
      }
      studentTotal = Math.round(Math.min(100, Math.max(0, sSum)) * 10) / 10;
      classTotal = Math.round(Math.min(100, Math.max(0, cSum)) * 10) / 10;
      advisorTotal = Math.round(Math.min(100, Math.max(0, aSum)) * 10) / 10;
      finalTotal = advisorTotal;
      const getClassif = (score: number) => score >= 90 ? 'EXCELLENT' : score >= 80 ? 'VERY_GOOD' : score >= 65 ? 'GOOD' : score >= 50 ? 'AVERAGE' : score >= 35 ? 'WEAK' : 'POOR';
      classification = (sheet as any).classification_override || getClassif(finalTotal);
    }
    return {
      id: e.users?.id || e.user_id,
      studentCode: e.users?.student_id || '',
      name: e.users?.full_name || '',
      email: e.users?.email || '',
      className: e.classes?.name || '',
      classCode: e.classes?.code || '',
      departmentName: e.classes?.departments?.name || '',
      status: sheet?.status || 'UPCOMING',
      studentTotal,
      classTotal,
      advisorTotal,
      finalTotal,
      score: finalTotal ?? advisorTotal ?? classTotal ?? studentTotal ?? 0,
      classification,
      sheetId: sheet?.id || null,
      enrollmentId: e.id,
    };
  });

  return NextResponse.json({ data: students });
}
