require('dotenv').config({ path: '../../.env' });
const { prisma } = require('@student-score/database'); 

async function main() { 
  console.log('--- STARTING DATABASE INTEGRITY CHECK ---');

  // 1. Check CLASS_COMMITTEE and ADVISOR roles for missing entity_id
  const classRolesCodes = ['MONITOR', 'VICE_MONITOR', 'SECRETARY', 'ADVISOR'];
  const missingEntityRoles = await prisma.user_roles.findMany({
    where: {
      roles: { code: { in: classRolesCodes } },
      entity_id: null,
      is_active: 1
    },
    include: { users: true, roles: true }
  });

  if (missingEntityRoles.length > 0) {
    console.log(`\n❌ FOUND ${missingEntityRoles.length} users with class roles missing entity_id (class_id):`);
    missingEntityRoles.forEach(ur => {
      console.log(`   - User: ${ur.users.email} | Role: ${ur.roles.code}`);
    });
  } else {
    console.log(`\n✅ All Class Committee & Advisor roles have correct entity_id.`);
  }

  // 2. Check DEPARTMENT roles for missing department_id in users table
  const deptUsers = await prisma.users.findMany({
    where: {
      user_roles: { some: { roles: { code: 'DEPARTMENT' }, is_active: 1 } },
      department_id: null,
      is_active: 1
    }
  });

  if (deptUsers.length > 0) {
    console.log(`\n❌ FOUND ${deptUsers.length} users with DEPARTMENT role missing department_id:`);
    deptUsers.forEach(u => {
      console.log(`   - User: ${u.email}`);
    });
  } else {
    console.log(`\n✅ All Department roles have correct department_id.`);
  }

  // 3. Check STUDENT roles for missing student_id
  const studentMissingId = await prisma.users.findMany({
    where: {
      user_roles: { some: { roles: { code: 'STUDENT' }, is_active: 1 } },
      student_id: null,
      is_active: 1
    }
  });

  if (studentMissingId.length > 0) {
    console.log(`\n❌ FOUND ${studentMissingId.length} students missing student_id (MSSV):`);
    studentMissingId.slice(0, 10).forEach(u => {
      console.log(`   - User: ${u.email}`);
    });
    if (studentMissingId.length > 10) console.log(`   ... and ${studentMissingId.length - 10} more.`);
  } else {
    console.log(`\n✅ All Students have student_id (MSSV).`);
  }

  // 4. Check STUDENT roles for missing active enrollment
  const activeSemester = await prisma.semesters.findFirst({
    where: { is_active: 1 },
    orderBy: { created_at: 'desc' }
  });

  if (activeSemester) {
    const studentsWithoutEnrollment = await prisma.users.findMany({
      where: {
        user_roles: { some: { roles: { code: 'STUDENT' }, is_active: 1 } },
        is_active: 1,
        semester_enrollments: {
            none: { semester_id: activeSemester.id, is_active: 1 }
        }
      }
    });

    if (studentsWithoutEnrollment.length > 0) {
      console.log(`\n❌ FOUND ${studentsWithoutEnrollment.length} students missing semester enrollment for active semester (${activeSemester.code}):`);
      studentsWithoutEnrollment.slice(0, 10).forEach(u => {
        console.log(`   - User: ${u.email}`);
      });
      if (studentsWithoutEnrollment.length > 10) console.log(`   ... and ${studentsWithoutEnrollment.length - 10} more.`);
    } else {
      console.log(`\n✅ All Students have active semester enrollments.`);
    }
  }

  console.log('\n--- CHECK COMPLETE ---');
} 

main().finally(() => prisma.$disconnect());
