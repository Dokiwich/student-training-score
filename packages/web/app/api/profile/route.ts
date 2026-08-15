import { auth } from '@/auth';
import { NextResponse } from 'next/server';
import { prisma } from '@student-score/database';
import { roleLabelConfig } from '../../../lib/statusConfig';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as any).id;
    const sessionRole = (session.user as any).role || 'STUDENT';

    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: {
        id: true,
        student_id: true,
        email: true,
        full_name: true,
        phone: true,
        avatar_url: true,
        is_active: true,
        user_roles: {
          where: { is_active: 1 },
          include: { roles: true }
        },
        departments: { select: { id: true, name: true, code: true } },
        semester_enrollments: {
          where: { is_active: 1 },
          orderBy: { enrolled_at: 'desc' },
          take: 1,
          select: { classes: { select: { id: true, name: true, code: true } } }
        }
      },
    });

    if (!user) {
      return NextResponse.json({ message: 'User not found' }, { status: 404 });
    }

    const activeClass = user.semester_enrollments?.[0]?.classes;
    const activeRoles = user.user_roles?.map((ur: any) => ur.roles.code) || [];
    
    // Determine the class position based on roles
    let classPosition = null;
    if (activeRoles.includes('MONITOR')) classPosition = 'Lớp trưởng';
    else if (activeRoles.includes('VICE_MONITOR')) classPosition = 'Lớp phó';
    else if (activeRoles.includes('SECRETARY')) classPosition = 'Bí thư';
    else if (activeRoles.includes('ADVISOR')) classPosition = 'Cố vấn học tập';

    const profile = {
      id: user.id,
      fullName: user.full_name,
      primaryEmail: user.email,
      phone: user.phone,
      avatarUrl: user.avatar_url,
      role: sessionRole,
      roleLabel: roleLabelConfig[sessionRole] || sessionRole,
      studentCode: user.student_id,
      staffCode: user.student_id, // Often stored in the same column for staff
      classId: activeClass?.id || null,
      classCode: activeClass?.code || null,
      className: activeClass?.name || null,
      departmentId: user.departments?.id || null,
      departmentCode: user.departments?.code || null,
      departmentName: user.departments?.name || null,
      classPosition: classPosition,
      accountStatus: user.is_active ? 'ACTIVE' : 'INACTIVE',
    };

    return NextResponse.json(profile);
  } catch (error) {
    console.error('Failed to fetch profile', error);
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}
