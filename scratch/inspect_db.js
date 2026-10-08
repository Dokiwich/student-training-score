const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const semesters = await prisma.semesters.findMany({
    include: {
      criteria_versions: {
        include: {
          criteria_categories: {
            include: {
              criteria: {
                orderBy: { sort_order: 'asc' }
              }
            }
          }
        }
      }
    }
  });

  console.log('Semesters count:', semesters.length);
  for (const s of semesters) {
    console.log(`\nSemester [${s.id}]: ${s.semester_code} - ${s.semester_name} (active: ${s.is_active})`);
    for (const cv of s.criteria_versions) {
      console.log(`  Version [${cv.id}]: ${cv.version_name} (active: ${cv.is_active})`);
      for (const cat of cv.criteria_categories) {
        console.log(`    Cat [${cat.id}]: "${cat.category_name}" (max_score: ${cat.max_score})`);
        for (const c of cat.criteria) {
          console.log(`      Criteria [${c.code}]: point=${c.point}, type=${c.score_type}, parent=${c.parent_id} -> "${c.content}"`);
        }
      }
    }
  }
}

run().catch(console.error).finally(() => prisma.$disconnect());
