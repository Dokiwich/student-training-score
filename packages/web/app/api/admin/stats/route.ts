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

  let semester;
  if (semesterId) {
    semester = await prisma.semesters.findUnique({ where: { id: semesterId } });
  } else {
    semester = await prisma.semesters.findFirst({ where: { is_active: 1 }, orderBy: { created_at: 'desc' } });
  }

  if (!semester) {
    return NextResponse.json({
      stats: { total: 0, submitted: 0, finalized: 0, avgScore: 0, byClassification: {}, byDepartment: [] }
    });
  }

  const enrollments = await prisma.semester_enrollments.findMany({
    where: { 
      semester_id: semester.id,
      users: {
        is_active: 1,
        student_id: { not: null },
      },
    },
    include: {
      scoring_sheets: {
        include: {
          score_details: {
            select: {
              score_entries: { select: { scorer_role: true, score: true } },
            },
          },
        },
      },
      classes: {
        include: { departments: true }
      }
    }
  });

  let submitted = 0;
  let finalized = 0;
  let totalScore = 0;
  let scoreCount = 0;
  const byClassification: Record<string, number> = {};
  const deptMap = new Map<string, any>(); // departmentName -> stats

  const getClassif = (score: number) => score >= 90 ? 'EXCELLENT' : score >= 80 ? 'VERY_GOOD' : score >= 65 ? 'GOOD' : score >= 50 ? 'AVERAGE' : score >= 35 ? 'WEAK' : 'POOR';

  for (const enr of enrollments) {
    const sheet = enr.scoring_sheets;
    const isSubmitted = sheet?.status && sheet.status !== 'DRAFT';
    if (isSubmitted) submitted++;
    
    if (sheet?.status === 'FINALIZED' || sheet?.status === 'SCHOOL_REVIEWING') finalized++;

    // ✅ 3NF: Compute totals at runtime
    let computedTotal: number | null = null;
    let classification: string | null = null;
    if (sheet && sheet.score_details) {
      let aSum = 0;
      for (const d of sheet.score_details) {
        const entries = d.score_entries || [];
        const sEntry = entries.find((x: any) => x.scorer_role === 'STUDENT');
        const cEntry = entries.find((x: any) => x.scorer_role === 'CLASS_COMMITTEE');
        const aEntry = entries.find((x: any) => x.scorer_role === 'ADVISOR');
        aSum += aEntry ? Number(aEntry.score) : (cEntry ? Number(cEntry.score) : (sEntry ? Number(sEntry.score) : 0));
      }
      computedTotal = Math.round(Math.min(100, Math.max(0, aSum)) * 10) / 10;
      classification = (sheet as any).classification_override || getClassif(computedTotal);
    }

    if (computedTotal != null) {
      totalScore += computedTotal;
      scoreCount++;
    }

    if (classification) {
      byClassification[classification] = (byClassification[classification] || 0) + 1;
    }

    // Khoa stats
    const deptName = enr.classes?.departments?.name || 'Chưa xếp khoa';
    const deptCode = enr.classes?.departments?.code || 'UNKNOWN';
    if (!deptMap.has(deptName)) {
      deptMap.set(deptName, {
        departmentName: deptName, departmentCode: deptCode,
        total: 0, submitted: 0, finalized: 0,
        sumScore: 0, scoreCount: 0, byClassification: {}
      });
    }
    const dStat = deptMap.get(deptName)!;
    dStat.total++;
    if (isSubmitted) dStat.submitted++;
    if (sheet?.status === 'FINALIZED' || sheet?.status === 'SCHOOL_REVIEWING') dStat.finalized++;
    
    if (computedTotal != null) {
      dStat.sumScore += computedTotal;
      dStat.scoreCount++;
    }

    if (classification) {
      dStat.byClassification[classification] = (dStat.byClassification[classification] || 0) + 1;
    }
  }

  const byDepartment = Array.from(deptMap.values()).map(d => ({
    ...d,
    avgScore: d.scoreCount > 0 ? parseFloat((d.sumScore / d.scoreCount).toFixed(1)) : 0,
    sumScore: undefined, scoreCount: undefined
  }));

  const avgScore = scoreCount > 0 ? parseFloat((totalScore / scoreCount).toFixed(1)) : 0;

  return NextResponse.json({
    semester,
    stats: {
      total: enrollments.length,
      submitted,
      finalized,
      avgScore,
      byClassification,
      byDepartment
    }
  });
}
