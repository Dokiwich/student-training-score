const { PrismaClient } = require('./src/generated/client');
const p = new PrismaClient();
p.$executeRawUnsafe('ALTER TABLE criteria RENAME COLUMN max_points TO point;')
  .then(console.log)
  .catch(console.error)
  .finally(() => p.$disconnect());
