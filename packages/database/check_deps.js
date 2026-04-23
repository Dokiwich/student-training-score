const { PrismaClient } = require('./src/generated/client');
const prisma = new PrismaClient();

async function main() {
  const depts = await prisma.departments.findMany();
  console.log('=== DEPARTMENTS ===');
  depts.forEach(d => console.log(`  id: "${d.id}" | code: "${d.code}" | name: "${d.name}"`));
  
  const classes = await prisma.classes.findMany({ take: 10 });
  console.log('\n=== CLASSES (first 10) ===');
  classes.forEach(c => console.log(`  id: "${c.id}" | code: "${c.code}" | dept_id: "${c.department_id}"`));
  
  await prisma.$disconnect();
  process.exit(0);
}
main();
