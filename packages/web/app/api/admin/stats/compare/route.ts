import { NextResponse } from 'next/server';
import { prisma } from '@student-score/database';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../auth/[...nextauth]/route';

function isAdmin(session: any): boolean {
  return session?.user && (session.user as { role?: string }).role === 'SCHOOL_ADMIN';
}

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
      where: { semester_id: sem.id },
      include: { scoring_sheets: true }
    });

    let total = enrollments.length;
    let sumScore = 0;
    let countScore = 0;
    const byClassification: Record<string, number> = {};

    for (const enr of enrollments) {
      const sheet = enr.scoring_sheets;
      if (sheet?.classification) {
        byClassification[sheet.classification] = (byClassification[sheet.classification] || 0) + 1;
      }
      if (sheet?.final_total != null) {
        sumScore += Number(sheet.final_total);
        countScore++;
      } else if (sheet?.advisor_total != null) {
        sumScore += Number(sheet.advisor_total);
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
