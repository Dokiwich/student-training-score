const { PrismaClient } = require('./src/generated/client');
const prisma = new PrismaClient();

async function main() {
  const testUsers = await prisma.users.findMany({
    where: {
      user_roles: {
        some: {
          roles: { code: { in: ['STUDENT'] } }
        },
        none: {
          roles: { code: { in: ['ADVISOR', 'DEPARTMENT'] } }
        }
      }
    },
    select: { email: true }
  });
  console.log(`Found ${testUsers.length} users with STUDENT but no ADVISOR/DEPARTMENT.`);
  
  const advUser = testUsers.find(u => u.email.includes('cvht24it'));
  console.log('Is cvht24it in the list?', !!advUser);
}
main().finally(() => process.exit(0));
