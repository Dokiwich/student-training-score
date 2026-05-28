import { PrismaClient } from '@student-score/database';

async function run() {
  const prisma = new PrismaClient();
  
  const user = await prisma.users.findFirst({ where: { email: 'advisor.23av@edu.vn' } });
  
  if (!user) return console.log('No user');
  console.log('User:', user.email, user.role);

  const activeSemester = await prisma.semesters.findFirst({
    where: { is_active: 1 },
    orderBy: { created_at: 'desc' }
  });
  
  let classIds: string[] = [];

  if (activeSemester) {
    const enrollment = await prisma.semester_enrollments.findUnique({
      where: {
        user_id_semester_id: {
          user_id: user.id,
          semester_id: activeSemester.id,
        },
      },
      select: { class_id: true },
    });
    if (enrollment) {
      classIds = [enrollment.class_id];
    }
  }

  // Fallback: class_roles (cho ADVISOR)
  if (classIds.length === 0) {
    const classRoles = await prisma.class_roles.findMany({
      where: { user_id: user.id, is_active: 1 },
      select: { class_id: true },
    });
    classIds = classRoles.map((cr) => cr.class_id);
  }

  console.log('Class IDs:', classIds);

  const enrollments = await prisma.semester_enrollments.findMany({
    where: {
      class_id: { in: classIds },
      ...(activeSemester ? { semester_id: activeSemester.id } : {}),
      is_active: 1,
      users: {
        role: { in: ['STUDENT', 'CLASS_COMMITTEE'] },
        is_active: 1,
      },
    },
    select: {
      users: { select: { id: true, email: true } }
    },
  });
  
  console.log('Found enrollments:', enrollments.length);
  
  await prisma.$disconnect();
}
run();
