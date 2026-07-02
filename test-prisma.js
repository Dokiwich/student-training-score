const { PrismaClient } = require('./packages/database/src/generated/client');
require('dotenv').config({ path: './.env' });

const prisma = new PrismaClient();

async function main() {
  try {
    const activeSemester = await prisma.semesters.findFirst({
      where: { is_active: 1 },
      orderBy: { created_at: 'desc' },
      select: { id: true },
    });
    console.log("Active semester:", activeSemester);
    if (!activeSemester) return;

    const activeVersion = await prisma.criteria_versions.findFirst({
      where: {
        semester_id: activeSemester.id,
        is_active: 1,
      },
      orderBy: { created_at: 'desc' },
    });
    console.log("Active version:", activeVersion);
    if (!activeVersion) return;

    const criteriaList = await prisma.criteria.findMany({
      where: { 
        is_active: 1,
        criteria_categories: {
          criteria_version_id: activeVersion.id,
        }
      },
      orderBy: [{ sort_order: 'asc' }, { code: 'asc' }, { id: 'asc' }],
    });
    console.log("Criteria length:", criteriaList.length);
  } catch (err) {
    console.error("ERROR:", err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
