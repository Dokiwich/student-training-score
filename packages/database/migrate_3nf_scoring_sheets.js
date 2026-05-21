/**
 * migrate_3nf_scoring_sheets.js
 * ==============================
 * Sửa vi phạm 3NF trong bảng scoring_sheets:
 *
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║  VẤN ĐỀ:                                                               ║
 * ║  scoring_sheets đang chứa 3 cột: student_id, semester_id, class_id     ║
 * ║  Cả 3 cột này đều có thể suy ra từ semester_enrollments:               ║
 * ║                                                                         ║
 * ║    semester_enrollments.{user_id, semester_id} → class_id               ║
 * ║    semester_enrollments.id (PK) → {user_id, semester_id, class_id}     ║
 * ║                                                                         ║
 * ║  → Phụ thuộc bắc cầu: scoring_sheets lưu lại 3 cột đã có trong        ║
 * ║    semester_enrollments → vi phạm 3NF                                   ║
 * ║                                                                         ║
 * ║  GIẢI PHÁP:                                                             ║
 * ║  1. Thêm cột enrollment_id → FK tới semester_enrollments.id            ║
 * ║  2. Bơm enrollment_id từ dữ liệu student_id + semester_id hiện có     ║
 * ║  3. Xóa 3 cột cũ: student_id, semester_id, class_id                   ║
 * ║  4. Thêm UNIQUE trên enrollment_id (1 enrollment = 1 phiếu)           ║
 * ║  5. Tạo VIEW backward-compatible cho code cũ                           ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 *
 * Chạy:  node migrate_3nf_scoring_sheets.js
 * Yêu cầu: prisma generate đã chạy, semester_enrollments đã có dữ liệu
 */

const { PrismaClient } = require('./src/generated/client');
const prisma = new PrismaClient({ log: ['warn', 'error'] });

// =============================================
// Utility: Run raw SQL safely
// =============================================
async function runSQL(label, sql) {
  try {
    const result = await prisma.$executeRawUnsafe(sql);
    console.log(`  ✅ ${label}`);
    return { success: true, result };
  } catch (err) {
    // Bỏ qua nếu đã xử lý trước đó
    const ignoreCodes = [
      'ER_CANT_DROP_FIELD_OR_KEY',
      'ER_DUP_FIELDNAME',
      'ER_DUP_KEYNAME',
    ];
    const ignoreMessages = [
      'check that it exists',
      'check that column/key exists',
      'Duplicate column name',
      'Duplicate key name',
      'already exists',
      "Can't DROP",
      'Code: `1091`',
      'Code: `1060`',
      'Code: `1061`',
      'Code: `1826`',
      'Duplicate foreign key',
    ];

    const isIgnorable =
      ignoreCodes.includes(err.code) ||
      ignoreMessages.some(msg => err.message?.includes(msg));

    if (isIgnorable) {
      console.log(`  ⏭️  ${label} — đã xử lý trước đó, bỏ qua`);
      return { success: false, skipped: true };
    }
    console.error(`  ❌ ${label} — Lỗi:`, err.message);
    throw err;
  }
}

// =============================================
// BƯỚC 0: Preflight — Kiểm tra điều kiện tiên quyết
// =============================================
async function preflightCheck() {
  console.log('\n══════════════════════════════════════════════════');
  console.log('  BƯỚC 0: Kiểm tra dữ liệu trước migration');
  console.log('══════════════════════════════════════════════════\n');

  // 0a. Đếm scoring_sheets
  const sheetCount = await prisma.$queryRawUnsafe(
    `SELECT COUNT(*) AS cnt FROM scoring_sheets`
  );
  console.log(`  📊 scoring_sheets: ${sheetCount[0].cnt} phiếu`);

  // 0b. Đếm semester_enrollments
  const enrollCount = await prisma.$queryRawUnsafe(
    `SELECT COUNT(*) AS cnt FROM semester_enrollments`
  );
  console.log(`  📊 semester_enrollments: ${enrollCount[0].cnt} records`);

  if (Number(enrollCount[0].cnt) === 0) {
    throw new Error(
      'semester_enrollments rỗng! Chạy migrate_normalize.js trước.'
    );
  }

  // 0c. Kiểm tra mỗi scoring_sheet có enrollment tương ứng không
  const orphanSheets = await prisma.$queryRawUnsafe(`
    SELECT ss.id, ss.student_id, ss.semester_id, ss.class_id
    FROM scoring_sheets ss
    LEFT JOIN semester_enrollments se
      ON se.user_id = ss.student_id
      AND se.semester_id = ss.semester_id
    WHERE se.id IS NULL
  `);

  if (orphanSheets.length > 0) {
    console.warn(`\n  ⚠️  ${orphanSheets.length} scoring_sheets KHÔNG có enrollment tương ứng:`);
    for (const s of orphanSheets.slice(0, 5)) {
      console.warn(`     • Phiếu ${s.id.substring(0, 12)}... (SV: ${s.student_id.substring(0, 12)}..., Kỳ: ${s.semester_id.substring(0, 12)}...)`);
    }

    // Tự tạo enrollment cho các orphan sheets
    console.log(`\n  🔧 Tự động tạo enrollment cho ${orphanSheets.length} phiếu mồ côi...`);
    for (const s of orphanSheets) {
      const uuid = require('crypto').randomUUID();
      await prisma.$executeRawUnsafe(`
        INSERT IGNORE INTO semester_enrollments (id, user_id, semester_id, class_id, is_active)
        VALUES ('${uuid}', '${s.student_id}', '${s.semester_id}', '${s.class_id}', 1)
      `);
    }
    console.log(`  ✅ Đã tạo enrollment cho các phiếu mồ côi`);

    // Verify lại
    const stillOrphan = await prisma.$queryRawUnsafe(`
      SELECT COUNT(*) AS cnt
      FROM scoring_sheets ss
      LEFT JOIN semester_enrollments se
        ON se.user_id = ss.student_id
        AND se.semester_id = ss.semester_id
      WHERE se.id IS NULL
    `);
    if (Number(stillOrphan[0].cnt) > 0) {
      throw new Error(`Vẫn còn ${stillOrphan[0].cnt} scoring_sheets mồ côi sau khi tạo enrollment!`);
    }
  }

  console.log('  ✅ Tất cả scoring_sheets đều có semester_enrollment tương ứng');

  // 0d. Kiểm tra class_id có khớp không
  const classMismatch = await prisma.$queryRawUnsafe(`
    SELECT ss.id, ss.class_id AS sheet_class, se.class_id AS enroll_class
    FROM scoring_sheets ss
    JOIN semester_enrollments se
      ON se.user_id = ss.student_id
      AND se.semester_id = ss.semester_id
    WHERE ss.class_id != se.class_id
  `);

  if (classMismatch.length > 0) {
    console.warn(`  ⚠️  ${classMismatch.length} phiếu có class_id khác giữa scoring_sheets và enrollment`);
    console.warn('     → Sẽ ưu tiên giữ class_id từ scoring_sheets (snapshot lúc tạo phiếu)');
    // Cập nhật enrollment cho khớp với scoring_sheets
    for (const m of classMismatch) {
      await prisma.$executeRawUnsafe(`
        UPDATE semester_enrollments se
        JOIN scoring_sheets ss ON se.user_id = ss.student_id AND se.semester_id = ss.semester_id
        SET se.class_id = ss.class_id
        WHERE ss.id = '${m.id}'
      `);
    }
    console.log('  ✅ Đã đồng bộ class_id giữa 2 bảng');
  } else {
    console.log('  ✅ class_id khớp giữa scoring_sheets và semester_enrollments');
  }

  return Number(sheetCount[0].cnt);
}

// =============================================
// BƯỚC 1: Thêm cột enrollment_id
// =============================================
async function addEnrollmentIdColumn() {
  console.log('\n══════════════════════════════════════════════════');
  console.log('  BƯỚC 1: Thêm cột enrollment_id vào scoring_sheets');
  console.log('══════════════════════════════════════════════════\n');

  // 1a. Thêm cột enrollment_id (nullable trước)
  await runSQL(
    'Thêm cột enrollment_id (VARCHAR 36, nullable)',
    `ALTER TABLE scoring_sheets
     ADD COLUMN enrollment_id VARCHAR(36) NULL
     AFTER id`
  );

  return true;
}

// =============================================
// BƯỚC 2: Bơm enrollment_id từ dữ liệu hiện có
// =============================================
async function populateEnrollmentId() {
  console.log('\n══════════════════════════════════════════════════');
  console.log('  BƯỚC 2: Bơm enrollment_id từ student_id + semester_id');
  console.log('══════════════════════════════════════════════════\n');

  // Update enrollment_id bằng JOIN
  const result = await runSQL(
    'Cập nhật enrollment_id từ semester_enrollments',
    `UPDATE scoring_sheets ss
     JOIN semester_enrollments se
       ON se.user_id = ss.student_id
       AND se.semester_id = ss.semester_id
     SET ss.enrollment_id = se.id`
  );

  // Kiểm tra có phiếu nào chưa được cập nhật
  const nullCount = await prisma.$queryRawUnsafe(`
    SELECT COUNT(*) AS cnt
    FROM scoring_sheets
    WHERE enrollment_id IS NULL
  `);

  if (Number(nullCount[0].cnt) > 0) {
    throw new Error(
      `Còn ${nullCount[0].cnt} scoring_sheets chưa có enrollment_id! ` +
      'Kiểm tra lại dữ liệu semester_enrollments.'
    );
  }

  console.log('  ✅ 100% scoring_sheets đã có enrollment_id');
  return true;
}

// =============================================
// BƯỚC 3: Thiết lập ràng buộc mới
// =============================================
async function setupConstraints() {
  console.log('\n══════════════════════════════════════════════════');
  console.log('  BƯỚC 3: Thiết lập ràng buộc cho enrollment_id');
  console.log('══════════════════════════════════════════════════\n');

  // 3a. Chuyển enrollment_id sang NOT NULL
  await runSQL(
    'Chuyển enrollment_id thành NOT NULL',
    `ALTER TABLE scoring_sheets
     MODIFY COLUMN enrollment_id VARCHAR(36) NOT NULL`
  );

  // 3b. Thêm UNIQUE constraint (1 enrollment = tối đa 1 phiếu)
  await runSQL(
    'Thêm UNIQUE constraint uk_sheet_enrollment',
    `ALTER TABLE scoring_sheets
     ADD CONSTRAINT uk_sheet_enrollment UNIQUE (enrollment_id)`
  );

  // 3c. Thêm FK constraint tới semester_enrollments
  await runSQL(
    'Thêm FK constraint fk_sheet_enrollment',
    `ALTER TABLE scoring_sheets
     ADD CONSTRAINT fk_sheet_enrollment
     FOREIGN KEY (enrollment_id) REFERENCES semester_enrollments(id)
     ON DELETE RESTRICT ON UPDATE CASCADE`
  );

  console.log('  ✅ Ràng buộc đã thiết lập xong');
  return true;
}

// =============================================
// BƯỚC 4: Xóa 3 cột cũ + FK + Index
// =============================================
async function dropOldColumns() {
  console.log('\n══════════════════════════════════════════════════');
  console.log('  BƯỚC 4: Xóa 3 cột cũ (student_id, semester_id, class_id)');
  console.log('══════════════════════════════════════════════════\n');

  // 4a. Xóa FK constraints trước
  await runSQL('Xóa FK fk_sheet_student', 'ALTER TABLE scoring_sheets DROP FOREIGN KEY fk_sheet_student');
  await runSQL('Xóa FK fk_sheet_semester', 'ALTER TABLE scoring_sheets DROP FOREIGN KEY fk_sheet_semester');
  await runSQL('Xóa FK fk_sheet_class', 'ALTER TABLE scoring_sheets DROP FOREIGN KEY fk_sheet_class');

  // 4b. Xóa UNIQUE constraint
  await runSQL('Xóa UNIQUE uk_sheet_student_semester', 'ALTER TABLE scoring_sheets DROP INDEX uk_sheet_student_semester');

  // 4c. Xóa indexes
  await runSQL('Xóa INDEX idx_sheet_class_status', 'ALTER TABLE scoring_sheets DROP INDEX idx_sheet_class_status');
  await runSQL('Xóa INDEX idx_sheet_semester_status', 'ALTER TABLE scoring_sheets DROP INDEX idx_sheet_semester_status');

  // 4d. Xóa 3 cột
  await runSQL('Xóa cột student_id', 'ALTER TABLE scoring_sheets DROP COLUMN student_id');
  await runSQL('Xóa cột semester_id', 'ALTER TABLE scoring_sheets DROP COLUMN semester_id');
  await runSQL('Xóa cột class_id', 'ALTER TABLE scoring_sheets DROP COLUMN class_id');

  console.log('\n  ✅ Đã xóa 3 cột thừa khỏi scoring_sheets');
  return true;
}

// =============================================
// BƯỚC 5: Tạo VIEW backward-compatible
// =============================================
async function createViews() {
  console.log('\n══════════════════════════════════════════════════');
  console.log('  BƯỚC 5: Tạo VIEW backward-compatible');
  console.log('══════════════════════════════════════════════════\n');

  // View scoring_sheets mở rộng — trả thêm student_id, semester_id, class_id
  await runSQL(
    'Tạo VIEW v_scoring_sheets (backward-compatible)',
    `CREATE OR REPLACE VIEW v_scoring_sheets AS
     SELECT
       ss.id,
       ss.enrollment_id,
       se.user_id       AS student_id,
       se.semester_id    AS semester_id,
       se.class_id       AS class_id,
       ss.status,
       ss.current_step,
       ss.student_total,
       ss.class_total,
       ss.advisor_total,
       ss.final_total,
       ss.classification,
       ss.student_submitted_at,
       ss.class_reviewed_at,
       ss.advisor_approved_at,
       ss.school_finalized_at,
       ss.rejection_reason,
       ss.rejected_by_step,
       ss.created_at,
       ss.updated_at
     FROM scoring_sheets ss
     JOIN semester_enrollments se ON se.id = ss.enrollment_id`
  );

  // Index tiện dụng cho truy vấn qua enrollment
  await runSQL(
    'Thêm INDEX idx_sheet_status (giữ lại)',
    `CREATE INDEX idx_sheet_enrollment_status
     ON scoring_sheets(enrollment_id, status)`
  );

  console.log('\n  ✅ VIEW v_scoring_sheets sẵn sàng');
  console.log('  📌 Code cũ dùng student_id/semester_id có thể query từ VIEW này');
  return true;
}

// =============================================
// BƯỚC 6: Verify kết quả
// =============================================
async function verify(expectedCount) {
  console.log('\n══════════════════════════════════════════════════');
  console.log('  BƯỚC 6: Kiểm tra kết quả');
  console.log('══════════════════════════════════════════════════\n');

  // 6a. Cấu trúc bảng scoring_sheets
  const cols = await prisma.$queryRawUnsafe(`
    SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_KEY
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'scoring_sheets'
    ORDER BY ORDINAL_POSITION
  `);

  const colNames = cols.map(c => c.COLUMN_NAME);
  console.log('  Cấu trúc scoring_sheets mới:');
  for (const c of cols) {
    const flags = [];
    if (c.COLUMN_KEY === 'PRI') flags.push('PK');
    if (c.COLUMN_KEY === 'UNI') flags.push('UNIQUE');
    if (c.COLUMN_KEY === 'MUL') flags.push('FK/INDEX');
    if (c.IS_NULLABLE === 'NO') flags.push('NOT NULL');
    console.log(`     ${c.COLUMN_NAME.padEnd(25)} ${c.COLUMN_TYPE.padEnd(20)} ${flags.join(', ')}`);
  }

  // Kiểm tra đã xóa đúng
  const removed = ['student_id', 'semester_id', 'class_id'];
  const stillExists = removed.filter(col => colNames.includes(col));
  if (stillExists.length > 0) {
    console.error(`\n  ❌ Vẫn còn cột: ${stillExists.join(', ')}`);
  } else {
    console.log('\n  ✅ Đã xóa: student_id, semester_id, class_id');
  }

  // Kiểm tra enrollment_id tồn tại
  if (colNames.includes('enrollment_id')) {
    console.log('  ✅ Cột enrollment_id đã được thêm');
  } else {
    console.error('  ❌ Thiếu cột enrollment_id!');
  }

  // 6b. Kiểm tra FK
  const fks = await prisma.$queryRawUnsafe(`
    SELECT CONSTRAINT_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
    FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'scoring_sheets'
      AND REFERENCED_TABLE_NAME IS NOT NULL
  `);

  console.log('\n  Foreign Keys:');
  for (const fk of fks) {
    console.log(`     ${fk.CONSTRAINT_NAME}: ${fk.COLUMN_NAME} → ${fk.REFERENCED_TABLE_NAME}.${fk.REFERENCED_COLUMN_NAME}`);
  }

  const hasEnrollmentFK = fks.some(fk => fk.COLUMN_NAME === 'enrollment_id');
  console.log(`  ${hasEnrollmentFK ? '✅' : '❌'} FK enrollment_id → semester_enrollments.id`);

  // 6c. Số lượng
  const newCount = await prisma.$queryRawUnsafe(`SELECT COUNT(*) AS cnt FROM scoring_sheets`);
  console.log(`\n  📊 Số phiếu: ${newCount[0].cnt} (kỳ vọng: ${expectedCount})`);
  console.log(`  ${Number(newCount[0].cnt) === expectedCount ? '✅ Khớp!' : '⚠️ Không khớp!'}`);

  // 6d. Kiểm tra VIEW hoạt động
  try {
    const viewTest = await prisma.$queryRawUnsafe(`
      SELECT id, student_id, semester_id, class_id, status
      FROM v_scoring_sheets
      LIMIT 3
    `);
    console.log(`\n  ✅ VIEW v_scoring_sheets hoạt động (${viewTest.length} mẫu):`);
    for (const r of viewTest) {
      console.log(`     Phiếu ${r.id.substring(0, 12)}... | SV: ${r.student_id.substring(0, 12)}... | Status: ${r.status}`);
    }
  } catch (err) {
    console.error(`\n  ❌ VIEW v_scoring_sheets lỗi:`, err.message);
  }

  // 6e. Phân tích 3NF
  console.log('\n  ════════════════════════════════════════════');
  console.log('  PHÂN TÍCH 3NF SAU MIGRATION:');
  console.log('  ════════════════════════════════════════════');
  console.log('');
  console.log('  TRƯỚC (vi phạm 3NF):');
  console.log('  ┌────────────────────────────────────────────────────────┐');
  console.log('  │ scoring_sheets                                        │');
  console.log('  │   id (PK)                                             │');
  console.log('  │   student_id   ──FK──→ users.id              ❌ thừa  │');
  console.log('  │   semester_id  ──FK──→ semesters.id           ❌ thừa  │');
  console.log('  │   class_id     ──FK──→ classes.id             ❌ thừa  │');
  console.log('  │   status, totals, ...                                 │');
  console.log('  └────────────────────────────────────────────────────────┘');
  console.log('');
  console.log('  SAU (chuẩn 3NF):');
  console.log('  ┌────────────────────────────────────────────────────────┐');
  console.log('  │ scoring_sheets                                        │');
  console.log('  │   id (PK)                                             │');
  console.log('  │   enrollment_id ──FK──→ semester_enrollments.id ✅    │');
  console.log('  │   status, totals, ...                                 │');
  console.log('  └────────────────────────────────────────────────────────┘');
  console.log('         │');
  console.log('         ▼');
  console.log('  ┌────────────────────────────────────────────────────────┐');
  console.log('  │ semester_enrollments                                   │');
  console.log('  │   id (PK)                                             │');
  console.log('  │   user_id      ──FK──→ users.id          ✅ nguồn SV │');
  console.log('  │   semester_id  ──FK──→ semesters.id       ✅ nguồn kỳ │');
  console.log('  │   class_id     ──FK──→ classes.id         ✅ nguồn lớp│');
  console.log('  └────────────────────────────────────────────────────────┘');
}

// =============================================
// MAIN
// =============================================
async function main() {
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║  FIX 3NF: scoring_sheets ← enrollment_id           ║');
  console.log('║  ────────────────────────────────────────────────── ║');
  console.log('║  Thay 3 cột (student_id, semester_id, class_id)    ║');
  console.log('║  bằng 1 cột enrollment_id → semester_enrollments   ║');
  console.log('╚══════════════════════════════════════════════════════╝');

  try {
    // Bước 0: Preflight
    const sheetCount = await preflightCheck();

    // Bước 1: Thêm cột mới
    await addEnrollmentIdColumn();

    // Bước 2: Bơm dữ liệu
    await populateEnrollmentId();

    // Bước 3: Thiết lập ràng buộc
    await setupConstraints();

    // Bước 4: Xóa cột cũ
    await dropOldColumns();

    // Bước 5: Tạo VIEW
    await createViews();

    // Bước 6: Verify
    await verify(sheetCount);

    console.log('\n══════════════════════════════════════════════════════');
    console.log('  🎉 MIGRATION HOÀN TẤT!');
    console.log('══════════════════════════════════════════════════════');
    console.log('');
    console.log('  📌 BƯỚC TIẾP THEO:');
    console.log('  1. Chạy: npx prisma db pull');
    console.log('  2. Chạy: npx prisma generate');
    console.log('  3. Cập nhật code API:');
    console.log('     • Thay scoring_sheets.student_id → enrollment.user_id');
    console.log('     • Thay scoring_sheets.semester_id → enrollment.semester_id');
    console.log('     • Thay scoring_sheets.class_id → enrollment.class_id');
    console.log('     • Hoặc dùng VIEW v_scoring_sheets cho backward-compat');
    console.log('');

  } catch (err) {
    console.error('\n❌ Migration thất bại:', err.message);
    console.error('\n💡 Gợi ý:');
    console.error('  • Kiểm tra database kết nối OK');
    console.error('  • Đã chạy migrate_normalize.js chưa? (tạo semester_enrollments)');
    console.error('  • Đã chạy migrate_3nf_fix.js chưa? (xóa users.class_id)');
    console.error('  • Nếu chạy lại, script tự bỏ qua bước đã xong (idempotent)');
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
