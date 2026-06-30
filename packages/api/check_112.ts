import { prisma } from '@student-score/database';
async function main() {
  const c = await prisma.criteria.findMany({
    where: { code: { startsWith: '1.1.2' } }
  });
  console.log(JSON.stringify(c.map(x => ({id: x.id, code: x.code, parent: x.parent_id, content: x.content, is_active: x.is_active})), null, 2));
}
main().finally(() => prisma.$disconnect());
