const { prisma } = require('@student-score/database');

async function main() {
  try {
    const v = await prisma.criteria_versions.findMany({ take: 3, select: { id: true, semester_id: true, is_active: true } });
    console.log('versions:', JSON.stringify(v, null, 2));

    if (v.length > 0) {
      const cats = await prisma.criteria_categories.findMany({ 
        where: { criteria_version_id: v[0].id },
        select: { id: true, criteria_version_id: true, code: true, name: true } 
      });
      console.log('categories:', JSON.stringify(cats, null, 2));

      if (cats.length > 0) {
        const crit = await prisma.criteria.findMany({ 
          where: { category_id: { in: cats.map(c => c.id) }, is_active: 1 },
          select: { id: true, code: true, content: true, category_id: true, parent_id: true, max_points: true },
          orderBy: { sort_order: 'asc' },
          take: 10
        });
        console.log('criteria count:', crit.length);
        console.log('criteria:', JSON.stringify(crit, null, 2));
      }
    }

    // Also check scoring sheets
    const sheets = await prisma.scoring_sheets.findMany({ take: 2, select: { id: true, enrollment_id: true } });
    console.log('sheets:', JSON.stringify(sheets, null, 2));

    if (sheets.length > 0) {
      const enrollment = await prisma.semester_enrollments.findUnique({ 
        where: { id: sheets[0].enrollment_id }, 
        select: { semester_id: true, user_id: true } 
      });
      console.log('enrollment:', JSON.stringify(enrollment, null, 2));
    }
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await prisma['$disconnect']();
  }
}

main();
