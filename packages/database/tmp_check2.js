const { PrismaClient } = require('./src/generated/client');
const p = new PrismaClient();
p.$queryRawUnsafe('SELECT * FROM criteria LIMIT 1')
  .then(console.log)
  .catch(console.error)
  .finally(() => p.$disconnect());
