const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const c = await prisma.criteria.findMany({ where: { parent_id: null }});
  console.log('ROOT CODES:', c.map(x => x.code));
  await prisma.$disconnect();
  process.exit(0);
}
main();
