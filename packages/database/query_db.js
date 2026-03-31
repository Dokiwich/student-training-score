const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const criteria = await prisma.criteria.findMany();
    console.log(JSON.stringify(criteria, null, 2));
  } catch(e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
}
main();
