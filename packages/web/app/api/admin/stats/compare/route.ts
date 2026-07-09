import { NextResponse } from 'next/server';
import { prisma } from '@student-score/database';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../auth/[...nextauth]/route';

function isAdmin(session: any): boolean {
  return session?.user && (session.user as { role?: string }).role === 'SCHOOL_ADMIN';
}

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!isAdmin(session)) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 403 });
  }

  // Get 3 most recent active/finalized semesters
  const semesters = await prisma.semesters.findMany({
    orderBy: { start_date: 'desc' },
    take: 3,
  });

  // Reverse to show oldest to newest left to right
  semesters.reverse();

  const comparisonData = [];

  for (const sem of semesters) {
    const enrollments = await prisma.semester_enrollments.findMany({
      where: { 
        semester_id: sem.id,
        users: {
          is_active: 1,
          student_id: { not: null },
        },
      },
      include: { scoring_sheets: {
        include: {
          score_details: {
            select: {
              score_entries: { select: { scorer_role: true, score: true } },
            },
          },
        },
      } }
    });

    let total = enrollments.length;
    let sumScore = 0;
    let countScore = 0;
    const byClassification: Record<string, number> = {};

    const getClassif = (score: number) => score >= 90 ? 'EXCELLENT' : score >= 80 ? 'VERY_GOOD' : score >= 65 ? 'GOOD' : score >= 50 ? 'AVERAGE' : score >= 35 ? 'WEAK' : 'POOR';

    for (const enr of enrollments) {
      const sheet = enr.scoring_sheets;
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
      if (classification) {
        byClassification[classification] = (byClassification[classification] || 0) + 1;
      }
      if (computedTotal != null) {
        sumScore += computedTotal;
        countScore++;
      }
    }

    comparisonData.push({
      semesterId: sem.id,
      semesterName: sem.name,
      semesterCode: sem.code,
      byClassification,
      total,
      avgScore: countScore > 0 ? parseFloat((sumScore / countScore).toFixed(1)) : 0,
    });
  }

  return NextResponse.json({ data: comparisonData });
}
