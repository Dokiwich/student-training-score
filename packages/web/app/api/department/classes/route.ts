import { NextResponse } from 'next/server';
import { prisma } from '@student-score/database';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';

async function getDepartmentUser(session: any) {
  if (!session?.user) return null;
  const userId = (session.user as any).id;
  const user = await prisma.users.findFirst({
    where: { id: userId },
    select: { id: true, role: true, department_id: true },
  });
  if (!user || user.role !== 'DEPARTMENT' || !user.department_id) return null;
  return user;
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  const deptUser = await getDepartmentUser(session);
  if (!deptUser) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 403 });
  }

  const classes = await prisma.classes.findMany({
    where: { department_id: deptUser.department_id!, is_active: 1 },
    orderBy: { code: 'asc' },
    select: {
      id: true,
      code: true,
      name: true,
      _count: { select: { semester_enrollments: true } },
    },
  });

  return NextResponse.json({
    data: classes.map(c => ({
      id: c.id,
      code: c.code,
      name: c.name,
      studentCount: c._count.semester_enrollments,
    })),
  });
}
