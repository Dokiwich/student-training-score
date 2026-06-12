const { PrismaClient } = require('./src/generated/client');
const prisma = new PrismaClient();

async function main() {
  const active = await prisma.criteria.findMany({
    where: { is_active: 1 },
    orderBy: [{ code: 'asc' }, { id: 'asc' }],
    select: { id: true, code: true, content: true, parent_id: true }
  });
  
  console.log(`Active criteria: ${active.length}`);
  
  // Check duplicates
  const codes = {};
  active.forEach(c => {
    if (!codes[c.code]) codes[c.code] = [];
    codes[c.code].push(c);
  });
  
  let hasDup = false;
  for (const [code, items] of Object.entries(codes)) {
    if (items.length > 1) {
      hasDup = true;
      console.log(`STILL DUPLICATE: code="${code}" x${items.length}`);
    }
  }
  
  if (!hasDup) {
    console.log('✅ No duplicates! All criteria codes are unique.');
  }
  
  // List all active criteria
  console.log('\n--- Active Criteria List ---');
  active.forEach(c => {
    const indent = c.parent_id ? '  ' : '';
    console.log(`${indent}[${c.id}] ${c.code}: ${c.content.substring(0, 70)}${c.parent_id ? ` (parent: ${c.parent_id})` : ''}`);
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
