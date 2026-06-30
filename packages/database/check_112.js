const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const c = await prisma.criteria.findMany({
    where: { code: { startsWith: '1.1.2' } }
  });
  console.log(c.map(x => ({id: x.id, code: x.code, parent: x.parent_id, content: x.content, is_active: x.is_active})));
}

main().finally(() => prisma.$disconnect());
