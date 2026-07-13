import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const FIXED_CODES = ['1.1.1', '2.1', '4.1', '3.1.1', '2.2'];
  
  console.log(`Updating score_type to FIXED for criteria: ${FIXED_CODES.join(', ')}`);
  
  const result = await prisma.criteria.updateMany({
    where: {
      code: {
        in: FIXED_CODES,
      },
    },
    data: {
      score_type: 'FIXED',
    },
  });
  
  console.log(`Updated ${result.count} criteria records.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
