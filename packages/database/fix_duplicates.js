const { PrismaClient } = require('./src/generated/client');
const prisma = new PrismaClient();

async function main() {
  // Get all active criteria, ordered by id ASC so first = original
  const all = await prisma.criteria.findMany({
    where: { is_active: 1 },
    orderBy: [{ code: 'asc' }, { id: 'asc' }],
    select: { id: true, code: true, parent_id: true }
  });

  // Group by code, keep first (lowest id), collect rest to deactivate
  const codeGroups = {};
  all.forEach(c => {
    if (!codeGroups[c.code]) codeGroups[c.code] = [];
    codeGroups[c.code].push(c);
  });

  const idsToDeactivate = [];
  for (const [code, items] of Object.entries(codeGroups)) {
    // Keep first, deactivate the rest
    for (let i = 1; i < items.length; i++) {
      idsToDeactivate.push(items[i].id);
    }
  }

  console.log(`Total active: ${all.length}`);
  console.log(`Unique codes: ${Object.keys(codeGroups).length}`);
  console.log(`To deactivate: ${idsToDeactivate.length}`);

  if (idsToDeactivate.length === 0) {
    console.log('Nothing to do!');
    return;
  }

  // Step 1: Check no score_details reference these IDs
  const refs = await prisma.score_details.findMany({
    where: { criteria_id: { in: idsToDeactivate } },
    select: { id: true }
  });

  if (refs.length > 0) {
    console.log(`ERROR: ${refs.length} score_details reference duplicate criteria. Cannot deactivate safely.`);
    return;
  }

  // Step 2: Deactivate duplicate criteria (set is_active = 0)
  const result = await prisma.criteria.updateMany({
    where: { id: { in: idsToDeactivate } },
    data: { is_active: 0 },
  });

  console.log(`Deactivated ${result.count} duplicate criteria.`);

  // Step 3: Fix parent_id references — remap children pointing to deactivated parents
  // Build mapping: for each deactivated ID, find the kept ID with the same code
  const codeToKeptId = {};
  for (const [code, items] of Object.entries(codeGroups)) {
    codeToKeptId[code] = items[0].id; // first = kept
  }

  // Now fix parent_id for kept criteria that might reference deactivated parents
  const keptIds = Object.values(codeToKeptId);
  const keptCriteria = await prisma.criteria.findMany({
    where: { id: { in: keptIds }, parent_id: { not: null } },
    select: { id: true, code: true, parent_id: true }
  });

  let fixedCount = 0;
  for (const c of keptCriteria) {
    if (c.parent_id && idsToDeactivate.includes(c.parent_id)) {
      // Find the parent's code
      const parentItem = all.find(a => a.id === c.parent_id);
      if (parentItem) {
        const correctParentId = codeToKeptId[parentItem.code];
        if (correctParentId && correctParentId !== c.parent_id) {
          await prisma.criteria.update({
            where: { id: c.id },
            data: { parent_id: correctParentId }
          });
          console.log(`Fixed parent_id for id=${c.id} (code=${c.code}): ${c.parent_id} → ${correctParentId}`);
          fixedCount++;
        }
      }
    }
  }

  console.log(`Fixed ${fixedCount} parent_id references.`);

  // Verify
  const remaining = await prisma.criteria.count({ where: { is_active: 1 } });
  console.log(`\nRemaining active criteria: ${remaining}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
