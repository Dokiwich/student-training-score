const { PrismaClient } = require('./src/generated/client');
const prisma = new PrismaClient();
async function main() {
  const criteria = await prisma.criteria.findMany({
    where: { code: { startsWith: '1.1' } },
    orderBy: { sort_order: 'asc' }
  });
  criteria.forEach(c => {
    console.log(`Code: ${c.code} | ScoreType: ${c.score_type} | Point: ${c.point} | Content: ${c.content}`);
  });
}
main().catch(console.error).finally(() => prisma.$disconnect());
