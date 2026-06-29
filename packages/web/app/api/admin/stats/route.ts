import { NextResponse } from 'next/server';
import { prisma } from '@student-score/database';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';

function isAdmin(session: any): boolean {
  return session?.user && (session.user as { role?: string }).role === 'SCHOOL_ADMIN';
}

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
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
    where: { semester_id: semester.id },
    include: {
      scoring_sheets: true,
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

  for (const enr of enrollments) {
    const sheet = enr.scoring_sheets;
    const isSubmitted = sheet?.status && sheet.status !== 'DRAFT';
    if (isSubmitted) submitted++;
    
    if (sheet?.status === 'FINALIZED' || sheet?.status === 'SCHOOL_REVIEWING') finalized++;

    if (sheet?.final_total != null) {
      totalScore += Number(sheet.final_total);
      scoreCount++;
    } else if (sheet?.advisor_total != null) {
      totalScore += Number(sheet.advisor_total);
      scoreCount++;
    }

    if (sheet?.classification) {
      byClassification[sheet.classification] = (byClassification[sheet.classification] || 0) + 1;
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
    
    if (sheet?.final_total != null) {
      dStat.sumScore += Number(sheet.final_total);
      dStat.scoreCount++;
    } else if (sheet?.advisor_total != null) {
      dStat.sumScore += Number(sheet.advisor_total);
      dStat.scoreCount++;
    }

    if (sheet?.classification) {
      dStat.byClassification[sheet.classification] = (dStat.byClassification[sheet.classification] || 0) + 1;
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
