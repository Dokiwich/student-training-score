require('dotenv').config({ path: '../../.env' });
const { prisma } = require('@student-score/database'); 

async function fix() {
  console.log('--- STARTING AUTO FIX ---');

  const classes = await prisma.classes.findMany();
  const classMap = new Map(classes.map(c => [c.code.toLowerCase(), c.id]));

  const classRolesCodes = ['MONITOR', 'VICE_MONITOR', 'SECRETARY', 'ADVISOR'];
  const missingEntityRoles = await prisma.user_roles.findMany({
    where: {
      roles: { code: { in: classRolesCodes } },
      entity_id: null,
      is_active: 1
    },
    include: { users: true, roles: true }
  });

  let fixedCount = 0;
  let notFoundCount = 0;

  for (const ur of missingEntityRoles) {
    const email = ur.users.email.toLowerCase();
    
    // e.g. bcs24it@classcommittee.mit.vn -> 24it
    // e.g. cvht21dh1101@advisor.mit.vn -> 21dh1101
    let extractedCode = null;
    if (email.startsWith('bcs')) {
      extractedCode = email.split('@')[0].replace('bcs', '');
    } else if (email.startsWith('cvht')) {
      extractedCode = email.split('@')[0].replace('cvht', '');
    }

    if (extractedCode && classMap.has(extractedCode)) {
      await prisma.user_roles.update({
        where: { id: ur.id },
        data: { entity_id: classMap.get(extractedCode) }
      });
      fixedCount++;
      console.log(`✅ Mapped ${email} to class ${extractedCode}`);
    } else {
      notFoundCount++;
      console.log(`❌ Could not map ${email} (extracted: ${extractedCode})`);
    }
  }

  console.log(`\n--- SUMMARY ---`);
  console.log(`Fixed: ${fixedCount}`);
  console.log(`Failed to map: ${notFoundCount}`);
}

fix().finally(() => prisma.$disconnect());
