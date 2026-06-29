const { PrismaClient } = require('./src/generated/client');
const prisma = new PrismaClient();

async function main() {
  const advisors = await prisma.users.findMany({
    where: {
      user_roles: {
        some: { roles: { code: 'ADVISOR' } }
      }
    },
    select: { id: true }
  });

  const advIds = advisors.map(a => a.id);

  const sheets = await prisma.scoring_sheets.findMany({
    where: {
      student_id: { in: advIds }
    }
  });

  console.log(`Found ${sheets.length} scoring sheets for ADVISORs.`);

  if (sheets.length > 0) {
    const sheetIds = sheets.map(s => s.id);
    const delEntries = await prisma.score_entries.deleteMany({
      where: { scoring_sheet_id: { in: sheetIds } }
    });
    console.log(`Deleted ${delEntries.count} score_entries.`);

    const delSheets = await prisma.scoring_sheets.deleteMany({
      where: { id: { in: sheetIds } }
    });
    console.log(`Deleted ${delSheets.count} scoring_sheets.`);
  }
}
main().finally(() => process.exit(0));
