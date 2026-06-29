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
      scoring_sheets: true
    }
  });

  const students = enrollments.map(e => {
    const sheet = e.scoring_sheets;
    return {
      id: e.users?.id || e.user_id,
      studentCode: e.users?.student_id || '',
      name: e.users?.full_name || '',
      email: e.users?.email || '',
      className: e.classes?.name || '',
      classCode: e.classes?.code || '',
      departmentName: e.classes?.departments?.name || '',
      status: sheet?.status || 'UPCOMING',
      studentTotal: sheet?.student_total != null ? Number(sheet.student_total) : null,
      classTotal: sheet?.class_total != null ? Number(sheet.class_total) : null,
      advisorTotal: sheet?.advisor_total != null ? Number(sheet.advisor_total) : null,
      finalTotal: sheet?.final_total != null ? Number(sheet.final_total) : null,
      score: sheet ? (sheet.final_total != null ? Number(sheet.final_total) : (sheet.advisor_total != null ? Number(sheet.advisor_total) : (sheet.class_total != null ? Number(sheet.class_total) : Number(sheet.student_total || 0)))) : 0,
      classification: sheet?.classification || null,
      sheetId: sheet?.id || null,
      enrollmentId: e.id,
    };
  });

  return NextResponse.json({ data: students });
}
