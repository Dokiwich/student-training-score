const { PrismaClient } = require('./src/generated/client');
const p = new PrismaClient();
p.criteria_versions.findMany({include:{semesters:true}}).then(v=>console.log(v)).finally(()=>p.$disconnect());
