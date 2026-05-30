import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const user = await prisma.users.findFirst({ where: { full_name: { contains: 'Bảo Oanh' } } });
  if (!user) return console.log('No user');
  console.log('Found:', user.full_name);
  const hk25 = await prisma.semesters.findFirst({ where: { name: { contains: '2025-2026' } }, orderBy: { created_at: 'desc' } });
  if (!hk25) return console.log('No HK');
  const enr = await prisma.semester_enrollments.findFirst({ where: { user_id: user.id } });
  if (enr) {
    await prisma.semester_enrollments.update({ where: { id: enr.id }, data: { semester_id: hk25.id } });
    console.log('Moved to', hk25.name);
  }
}
main().catch(console.error).finally(()=>prisma.$disconnect());
