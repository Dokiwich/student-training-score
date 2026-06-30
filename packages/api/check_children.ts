import { prisma } from '@student-score/database';
async function main() {
  const c = await prisma.criteria.findMany({
    where: { parent_id: 129 }
  });
  console.log(JSON.stringify(c, null, 2));
}
main().finally(() => prisma.$disconnect());
