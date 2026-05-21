/**
 * migrate_3nf_fix.js
 * ===================
 * Sửa vi phạm chuẩn 3NF trong database:
 *
 * ╔════════════════════════════════════════════════════════════════════════╗
 * ║  VẤN ĐỀ 1 — Bảng `appeals`                                         ║
 * ║  Cột `student_id` là phụ thuộc bắc cầu (transitive dependency):     ║
 * ║  appeals.scoring_sheet_id → scoring_sheets.student_id               ║
 * ║  → student_id có thể tra cứu qua scoring_sheets, không cần lưu lại ║
 * ║                                                                      ║
 * ║  VẤN ĐỀ 2 — Bảng `semester_enrollments`                             ║
 * ║  Cột `class_id` trùng lặp với `users.class_id`.                    ║
 * ║  Tuy nhiên semester_enrollments là nguồn chính thức (cho phép SV    ║
 * ║  chuyển lớp theo từng kỳ), nên giải pháp đúng là:                  ║
 * ║  → Xóa `users.class_id` (deprecated), giữ semester_enrollments     ║
 * ╚════════════════════════════════════════════════════════════════════════╝
 *
 * Chạy:  node migrate_3nf_fix.js
 * Yêu cầu: prisma generate đã chạy trước
 */

const { PrismaClient } = require('./src/generated/client');
const prisma = new PrismaClient({ log: ['warn', 'error'] });

// =============================================
// Utility: Run raw SQL safely
// =============================================
async function runSQL(label, sql) {
  try {
    await prisma.$executeRawUnsafe(sql);
    console.log(`  ✅ ${label}`);
    return true;
  } catch (err) {
    if (err.code === 'ER_CANT_DROP_FIELD_OR_KEY' || err.message?.includes('check that it exists')) {
      console.log(`  ⏭️  ${label} — đã xử lý trước đó, bỏ qua`);
      return false;
    }
    console.error(`  ❌ ${label} — Lỗi:`, err.message);
    throw err;
  }
}

// =============================================
// BƯỚC 1: Xác minh dữ liệu trước khi migrate
// =============================================
async function preflightCheck() {
  console.log('\n══════════════════════════════════════════');
  console.log('  BƯỚC 0: Kiểm tra dữ liệu trước migrate');
  console.log('══════════════════════════════════════════\n');

  // 1a. Kiểm tra appeals.student_id có khớp scoring_sheets.student_id không
  const mismatchAppeals = await prisma.$queryRawUnsafe(`
    SELECT a.id AS appeal_id,
           a.student_id AS appeal_student,
           ss.student_id AS sheet_student
    FROM appeals a
    JOIN scoring_sheets ss ON ss.id = a.scoring_sheet_id
    WHERE a.student_id != ss.student_id
  `);

  if (mismatchAppeals.length > 0) {
    console.error('  ❌ Phát hiện appeals có student_id KHÔNG khớp scoring_sheets!');
    console.table(mismatchAppeals);
    throw new Error(
      `${mismatchAppeals.length} appeals có student_id không khớp scoring_sheets.student_id. ` +
      'Cần sửa dữ liệu trước khi xóa cột.'
    );
  }
  console.log('  ✅ Tất cả appeals.student_id khớp scoring_sheets.student_id');

  // 1b. Kiểm tra users.class_id có đồng bộ với semester_enrollments không
  const usersWithClass = await prisma.$queryRawUnsafe(`
    SELECT COUNT(*) AS cnt
    FROM users
    WHERE class_id IS NOT NULL
  `);
  const enrollmentCount = await prisma.$queryRawUnsafe(`
    SELECT COUNT(*) AS cnt FROM semester_enrollments
  `);

  console.log(`  📊 users có class_id: ${usersWithClass[0].cnt}`);
  console.log(`  📊 semester_enrollments: ${enrollmentCount[0].cnt} records`);

  // Cảnh báo nếu có users có class_id nhưng chưa có enrollment
  const usersNoEnrollment = await prisma.$queryRawUnsafe(`
    SELECT u.id, u.full_name, u.class_id
    FROM users u
    WHERE u.class_id IS NOT NULL
      AND u.id NOT IN (SELECT DISTINCT user_id FROM semester_enrollments)
    LIMIT 10
  `);

  if (usersNoEnrollment.length > 0) {
    console.warn(`  ⚠️  ${usersNoEnrollment.length} users có class_id nhưng chưa có enrollment`);
    console.warn('     → Cần chạy migrate_normalize.js trước để tạo enrollments!');
    console.table(usersNoEnrollment.slice(0, 5));
    throw new Error(
      'Có users chưa được migrate sang semester_enrollments. ' +
      'Chạy: node migrate_normalize.js trước.'
    );
  }
  console.log('  ✅ Tất cả users có class_id đã có semester_enrollments tương ứng');

  return true;
}

// =============================================
// BƯỚC 2: Sửa bảng appeals — Xóa cột student_id
// =============================================
async function fixAppeals() {
  console.log('\n══════════════════════════════════════════');
  console.log('  BƯỚC 1: Sửa bảng appeals (xóa student_id)');
  console.log('══════════════════════════════════════════\n');

  console.log('  📝 Lý do: appeals.student_id là phụ thuộc bắc cầu');
  console.log('     appeals.scoring_sheet_id → scoring_sheets.student_id');
  console.log('     → Có thể JOIN để lấy, không cần lưu trùng lặp\n');

  // 2a. Xóa foreign key constraint trước
  await runSQL(
    'Xóa FK constraint fk_appeal_student',
    'ALTER TABLE appeals DROP FOREIGN KEY fk_appeal_student'
  );

  // 2b. Xóa index
  await runSQL(
    'Xóa index idx_appeal_student',
    'ALTER TABLE appeals DROP INDEX idx_appeal_student'
  );

  // 2c. Xóa cột student_id
  await runSQL(
    'Xóa cột student_id khỏi appeals',
    'ALTER TABLE appeals DROP COLUMN student_id'
  );

  console.log('\n  ✅ Bảng appeals đã chuẩn 3NF');
  console.log('  📌 Để lấy student_id, dùng JOIN:');
  console.log('     SELECT a.*, ss.student_id');
  console.log('     FROM appeals a');
  console.log('     JOIN scoring_sheets ss ON ss.id = a.scoring_sheet_id');
}

// =============================================
// BƯỚC 3: Sửa bảng users — Xóa cột class_id (deprecated)
// =============================================
async function fixUsersClassId() {
  console.log('\n══════════════════════════════════════════');
  console.log('  BƯỚC 2: Xóa users.class_id (deprecated)');
  console.log('══════════════════════════════════════════\n');

  console.log('  📝 Lý do: users.class_id bị dư thừa vì đã có semester_enrollments');
  console.log('     semester_enrollments lưu class_id theo từng kỳ (đúng chuẩn hơn)');
  console.log('     users.class_id chỉ lưu 1 lớp duy nhất → sai nếu SV chuyển lớp\n');

  // 3a. Xóa FK constraint
  await runSQL(
    'Xóa FK constraint fk_user_class',
    'ALTER TABLE users DROP FOREIGN KEY fk_user_class'
  );

  // 3b. Xóa index
  await runSQL(
    'Xóa index idx_user_class',
    'ALTER TABLE users DROP INDEX idx_user_class'
  );

  // 3c. Xóa cột class_id
  await runSQL(
    'Xóa cột class_id khỏi users',
    'ALTER TABLE users DROP COLUMN class_id'
  );

  console.log('\n  ✅ Bảng users đã loại bỏ class_id dư thừa');
  console.log('  📌 Để lấy class_id của user theo kỳ, dùng:');
  console.log('     SELECT se.class_id');
  console.log('     FROM semester_enrollments se');
  console.log('     WHERE se.user_id = ? AND se.semester_id = ?');
}

// =============================================
// BƯỚC 4: Tạo VIEW tiện dụng cho query
// =============================================
async function createHelperViews() {
  console.log('\n══════════════════════════════════════════');
  console.log('  BƯỚC 3: Tạo VIEW truy vấn tiện dụng');
  console.log('══════════════════════════════════════════\n');

  // View 1: appeals kèm student_id (backward compatible)
  await runSQL(
    'Tạo VIEW v_appeals_with_student',
    `CREATE OR REPLACE VIEW v_appeals_with_student AS
     SELECT
       a.id,
       a.scoring_sheet_id,
       ss.student_id,
       a.reason,
       a.evidence_note,
       a.status,
       a.resolved_by,
       a.resolution,
       a.created_at,
       a.resolved_at
     FROM appeals a
     JOIN scoring_sheets ss ON ss.id = a.scoring_sheet_id`
  );

  // View 2: users kèm class_id hiện tại (backward compatible)
  await runSQL(
    'Tạo VIEW v_users_current_class',
    `CREATE OR REPLACE VIEW v_users_current_class AS
     SELECT
       u.*,
       se.class_id AS current_class_id,
       se.semester_id AS current_semester_id
     FROM users u
     LEFT JOIN semester_enrollments se ON se.user_id = u.id AND se.is_active = 1
     LEFT JOIN semesters s ON s.id = se.semester_id AND s.is_active = 1`
  );

  console.log('\n  ✅ Views tạo xong — Code cũ có thể dùng view thay thế');
}

// =============================================
// BƯỚC 5: Verify kết quả
// =============================================
async function verify() {
  console.log('\n══════════════════════════════════════════');
  console.log('  BƯỚC 4: Kiểm tra kết quả');
  console.log('══════════════════════════════════════════\n');

  // 5a. Kiểm tra cấu trúc appeals
  const appealsCols = await prisma.$queryRawUnsafe(`
    SELECT COLUMN_NAME
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'appeals'
    ORDER BY ORDINAL_POSITION
  `);
  const appealsColNames = appealsCols.map(c => c.COLUMN_NAME);

  if (appealsColNames.includes('student_id')) {
    console.error('  ❌ appeals vẫn còn cột student_id!');
  } else {
    console.log('  ✅ appeals: đã xóa student_id');
  }
  console.log(`     Các cột hiện tại: ${appealsColNames.join(', ')}`);

  // 5b. Kiểm tra cấu trúc users
  const usersCols = await prisma.$queryRawUnsafe(`
    SELECT COLUMN_NAME
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'users'
    ORDER BY ORDINAL_POSITION
  `);
  const usersColNames = usersCols.map(c => c.COLUMN_NAME);

  if (usersColNames.includes('class_id')) {
    console.error('  ❌ users vẫn còn cột class_id!');
  } else {
    console.log('  ✅ users: đã xóa class_id');
  }
  console.log(`     Các cột hiện tại: ${usersColNames.join(', ')}`);

  // 5c. Kiểm tra view hoạt động
  try {
    const viewTest = await prisma.$queryRawUnsafe(`SELECT COUNT(*) AS cnt FROM v_appeals_with_student`);
    console.log(`  ✅ VIEW v_appeals_with_student hoạt động (${viewTest[0].cnt} rows)`);
  } catch {
    console.warn('  ⚠️  VIEW v_appeals_with_student chưa tạo được');
  }

  try {
    const viewTest2 = await prisma.$queryRawUnsafe(`SELECT COUNT(*) AS cnt FROM v_users_current_class`);
    console.log(`  ✅ VIEW v_users_current_class hoạt động (${viewTest2[0].cnt} rows)`);
  } catch {
    console.warn('  ⚠️  VIEW v_users_current_class chưa tạo được');
  }

  // 5d. Phân tích 3NF
  console.log('\n  ════════════════════════════════════');
  console.log('  PHÂN TÍCH 3NF SAU MIGRATION:');
  console.log('  ════════════════════════════════════');
  console.log('');
  console.log('  ✅ appeals:');
  console.log('     • scoring_sheet_id → (tất cả thông tin appeal)');
  console.log('     • student_id đã xóa → tra qua scoring_sheets');
  console.log('     • Không còn phụ thuộc bắc cầu');
  console.log('');
  console.log('  ✅ semester_enrollments:');
  console.log('     • {user_id, semester_id} → class_id');
  console.log('     • Là nguồn duy nhất của class_id theo kỳ');
  console.log('     • users.class_id (deprecated) đã bị xóa');
  console.log('');
  console.log('  ✅ users:');
  console.log('     • Không còn cột class_id dư thừa');
  console.log('     • class_id tra qua semester_enrollments');
}

// =============================================
// MAIN
// =============================================
async function main() {
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║  FIX 3NF: appeals + semester_enrollments     ║');
  console.log('║  ─────────────────────────────────────────── ║');
  console.log('║  1. Xóa appeals.student_id (bắc cầu)        ║');
  console.log('║  2. Xóa users.class_id (dư thừa)            ║');
  console.log('║  3. Tạo VIEW backward-compatible             ║');
  console.log('╚══════════════════════════════════════════════╝');

  try {
    // Bước 0: Preflight
    await preflightCheck();

    // Bước 1: Fix appeals
    await fixAppeals();

    // Bước 2: Fix users.class_id
    await fixUsersClassId();

    // Bước 3: Views
    await createHelperViews();

    // Bước 4: Verify
    await verify();

    console.log('\n══════════════════════════════════════════');
    console.log('  🎉 MIGRATION 3NF HOÀN TẤT!');
    console.log('══════════════════════════════════════════');
    console.log('');
    console.log('  📌 QUAN TRỌNG — Cần cập nhật sau migration:');
    console.log('  1. Chạy: npx prisma db pull   (pull schema mới)');
    console.log('  2. Chạy: npx prisma generate  (regenerate client)');
    console.log('  3. Cập nhật code API:');
    console.log('     • appeals query: JOIN scoring_sheets để lấy student_id');
    console.log('     • users query: dùng semester_enrollments thay class_id');
    console.log('     • Hoặc dùng VIEW: v_appeals_with_student, v_users_current_class');
    console.log('');

  } catch (err) {
    console.error('\n❌ Migration thất bại:', err.message);
    console.error('\n💡 Gợi ý:');
    console.error('  • Kiểm tra database có đang kết nối không');
    console.error('  • Đã chạy migrate_normalize.js trước chưa?');
    console.error('  • Kiểm tra .env có DATABASE_URL đúng không');
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
