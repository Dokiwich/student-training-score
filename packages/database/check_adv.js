const { PrismaClient } = require('./src/generated/client');
const prisma = new PrismaClient();

async function main() {
  const advisors = await prisma.users.findMany({
    where: {
      user_roles: {
        some: { roles: { code: 'ADVISOR' } }
      }
    },
    include: {
      user_roles: true,
      semester_enrollments: true
    }
  });

  for (const adv of advisors) {
    const roleEntry = adv.user_roles.find(r => r.roles_code === 'ADVISOR' || r.role_id);
    console.log(`Advisor ${adv.email}: entity_id = ${roleEntry.entity_id}, enrollments = ${adv.semester_enrollments.length}`);
  }
}
main().finally(() => process.exit(0));
