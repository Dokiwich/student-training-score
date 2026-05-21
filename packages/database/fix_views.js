/**
 * fix_views.js
 * =============
 * Sửa lại các VIEW bị vỡ sau migration 3NF.
 * 
 * Nguyên nhân: VIEW v_appeals_with_student được tạo khi scoring_sheets
 * còn cột student_id. Sau khi migrate_3nf_scoring_sheets.js xóa cột đó,
 * VIEW bị lỗi 1356 (View references invalid table(s) or column(s)).
 * 
 * Fix: Tạo lại VIEW với JOIN qua semester_enrollments.
 */

const { PrismaClient } = require('./src/generated/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🔧 Sửa VIEW bị vỡ sau migration 3NF...\n');

  // 1. Fix v_appeals_with_student
  //    Cũ: JOIN scoring_sheets → lấy ss.student_id (đã bị xóa!)
  //    Mới: JOIN scoring_sheets → JOIN semester_enrollments → lấy se.user_id
  try {
    await prisma.$executeRawUnsafe(`
      CREATE OR REPLACE VIEW v_appeals_with_student AS
      SELECT
        a.id,
        a.scoring_sheet_id,
        se.user_id       AS student_id,
        a.reason,
        a.evidence_note,
        a.status,
        a.resolved_by,
        a.resolution,
        a.created_at,
        a.resolved_at
      FROM appeals a
      JOIN scoring_sheets ss ON ss.id = a.scoring_sheet_id
      JOIN semester_enrollments se ON se.id = ss.enrollment_id
    `);
    console.log('  ✅ v_appeals_with_student — đã sửa (JOIN qua enrollment)');
  } catch (err) {
    console.error('  ❌ v_appeals_with_student — lỗi:', err.message);
  }

  // 2. Fix v_users_current_class
  //    Cũ: SELECT u.* (khi users còn class_id)
  //    Mới: SELECT từng cột cụ thể (users đã xóa class_id)
  try {
    await prisma.$executeRawUnsafe(`
      CREATE OR REPLACE VIEW v_users_current_class AS
      SELECT
        u.id,
        u.student_id,
        u.email,
        u.full_name,
        u.avatar_url,
        u.phone,
        u.role,
        u.department_id,
        u.is_active,
        u.last_login_at,
        u.created_at,
        u.updated_at,
        se.class_id       AS current_class_id,
        se.semester_id    AS current_semester_id
      FROM users u
      LEFT JOIN semester_enrollments se
        ON se.user_id = u.id AND se.is_active = 1
      LEFT JOIN semesters s
        ON s.id = se.semester_id AND s.is_active = 1
    `);
    console.log('  ✅ v_users_current_class — đã sửa (liệt kê cột thay u.*)');
  } catch (err) {
    console.error('  ❌ v_users_current_class — lỗi:', err.message);
  }

  // 3. Verify v_scoring_sheets (đã tạo đúng từ migrate_3nf_scoring_sheets.js)
  try {
    const test = await prisma.$queryRawUnsafe(`SELECT COUNT(*) AS cnt FROM v_scoring_sheets`);
    console.log(`  ✅ v_scoring_sheets — OK (${test[0].cnt} rows)`);
  } catch (err) {
    console.error('  ❌ v_scoring_sheets — lỗi:', err.message);
  }

  // 4. Verify all views
  console.log('\n📊 Kiểm tra tất cả VIEW:');
  try {
    const t1 = await prisma.$queryRawUnsafe(`SELECT COUNT(*) AS cnt FROM v_appeals_with_student`);
    console.log(`  v_appeals_with_student: ${t1[0].cnt} rows ✅`);
  } catch (err) {
    console.error(`  v_appeals_with_student: LỖI ❌ — ${err.message}`);
  }
  try {
    const t2 = await prisma.$queryRawUnsafe(`SELECT COUNT(*) AS cnt FROM v_users_current_class`);
    console.log(`  v_users_current_class:  ${t2[0].cnt} rows ✅`);
  } catch (err) {
    console.error(`  v_users_current_class:  LỖI ❌ — ${err.message}`);
  }
  try {
    const t3 = await prisma.$queryRawUnsafe(`SELECT COUNT(*) AS cnt FROM v_scoring_sheets`);
    console.log(`  v_scoring_sheets:       ${t3[0].cnt} rows ✅`);
  } catch (err) {
    console.error(`  v_scoring_sheets:       LỖI ❌ — ${err.message}`);
  }

  console.log('\n🎉 Xong!');
  await prisma.$disconnect();
}

main();
