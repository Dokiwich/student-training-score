/**
 * seed_department_role.js
 * ========================
 * 1. Thêm enum value 'DEPARTMENT' vào users_role
 * 2. Tạo user mẫu có role DEPARTMENT gắn vào department có sẵn
 * 
 * 3NF: Không thêm bảng/cột mới.
 *   users.department_id → departments → classes → semester_enrollments → scoring_sheets
 *   User DEPARTMENT chỉ cần department_id để xác định phạm vi quản lý.
 */

const { PrismaClient } = require('./src/generated/client');
const { randomUUID } = require('crypto');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║  SEED: Thêm role DEPARTMENT + User mẫu          ║');
  console.log('╚══════════════════════════════════════════════════╝\n');

  // ──────────────────────────────────────────────
  // BƯỚC 1: Thêm 'DEPARTMENT' vào enum users_role
  // ──────────────────────────────────────────────
  console.log('══ BƯỚC 1: Thêm DEPARTMENT vào enum users_role ══\n');
  try {
    // Kiểm tra enum hiện tại
    const [enumInfo] = await prisma.$queryRawUnsafe(`
      SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'users' 
      AND COLUMN_NAME = 'role'
    `);
    console.log('  Enum hiện tại:', enumInfo.COLUMN_TYPE);

    if (enumInfo.COLUMN_TYPE.includes('DEPARTMENT')) {
      console.log('  ⏭️  DEPARTMENT đã có trong enum, bỏ qua\n');
    } else {
      await prisma.$executeRawUnsafe(`
        ALTER TABLE users 
        MODIFY COLUMN role ENUM('STUDENT','CLASS_COMMITTEE','ADVISOR','DEPARTMENT','SCHOOL_ADMIN') 
        NOT NULL DEFAULT 'STUDENT'
      `);
      console.log('  ✅ Đã thêm DEPARTMENT vào enum users_role\n');
    }
  } catch (err) {
    console.error('  ❌ Lỗi thêm enum:', err.message);
    throw err;
  }

  // ──────────────────────────────────────────────
  // BƯỚC 2: Tìm department có sẵn để gắn user mẫu
  // ──────────────────────────────────────────────
  console.log('══ BƯỚC 2: Tạo user mẫu role DEPARTMENT ══\n');
  
  const departments = await prisma.$queryRawUnsafe(`
    SELECT id, code, name FROM departments WHERE is_active = 1 ORDER BY code
  `);
  
  if (departments.length === 0) {
    console.log('  ⚠️  Không có department nào! Tạo department mẫu...');
    const deptId = randomUUID();
    await prisma.$executeRawUnsafe(`
      INSERT INTO departments (id, code, name, is_active, created_at)
      VALUES (?, 'CNTT', 'Công nghệ thông tin', 1, NOW())
    `, deptId);
    departments.push({ id: deptId, code: 'CNTT', name: 'Công nghệ thông tin' });
    console.log('  ✅ Đã tạo department: CNTT\n');
  }

  console.log('  📋 Departments hiện có:');
  departments.forEach(d => console.log(`     • ${d.code} — ${d.name} (${d.id.substring(0, 8)}...)`));

  // Tạo 1 user DEPARTMENT cho mỗi khoa
  let created = 0;
  for (const dept of departments) {
    const email = `khoa.${dept.code.toLowerCase()}@university.edu.vn`;
    
    // Kiểm tra đã tồn tại chưa
    const [existing] = await prisma.$queryRawUnsafe(`
      SELECT id FROM users WHERE email = ?
    `, email);
    
    if (existing) {
      console.log(`  ⏭️  User ${email} đã tồn tại`);
      continue;
    }

    const userId = `U_DEPT_${dept.code}`;
    const passwordHash = await bcrypt.hash('dept123', 10);

    await prisma.$executeRawUnsafe(`
      INSERT INTO users (id, email, password_hash, full_name, role, department_id, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'DEPARTMENT', ?, 1, NOW(), NOW())
    `, userId, email, passwordHash, `Trưởng khoa ${dept.name}`, dept.id);

    console.log(`  ✅ Tạo user: ${email} | pass: dept123 | dept: ${dept.code}`);
    created++;
  }

  console.log(`\n  📊 Tạo ${created} user DEPARTMENT mới`);

  // ──────────────────────────────────────────────
  // BƯỚC 3: Verify
  // ──────────────────────────────────────────────
  console.log('\n══ BƯỚC 3: Kiểm tra kết quả ══\n');

  const [enumCheck] = await prisma.$queryRawUnsafe(`
    SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'users' 
    AND COLUMN_NAME = 'role'
  `);
  console.log('  Enum users_role:', enumCheck.COLUMN_TYPE);

  const deptUsers = await prisma.$queryRawUnsafe(`
    SELECT u.id, u.email, u.full_name, u.role, d.code AS dept_code
    FROM users u 
    LEFT JOIN departments d ON d.id = u.department_id
    WHERE u.role = 'DEPARTMENT'
  `);
  console.log(`  User DEPARTMENT: ${deptUsers.length}`);
  deptUsers.forEach(u => console.log(`     • ${u.email} — ${u.full_name} (${u.dept_code})`));

  // Verify 3NF path: user → dept → classes → enrollments → sheets
  if (deptUsers.length > 0) {
    const sample = deptUsers[0];
    const classCount = await prisma.$queryRawUnsafe(`
      SELECT COUNT(*) AS cnt FROM classes c
      JOIN departments d ON d.id = c.department_id
      JOIN users u ON u.department_id = d.id
      WHERE u.id = ?
    `, sample.id);
    
    const enrollCount = await prisma.$queryRawUnsafe(`
      SELECT COUNT(*) AS cnt FROM semester_enrollments se
      JOIN classes c ON c.id = se.class_id
      JOIN departments d ON d.id = c.department_id
      JOIN users u ON u.department_id = d.id
      WHERE u.id = ?
    `, sample.id);

    console.log(`\n  🔗 3NF path cho ${sample.email}:`);
    console.log(`     departments → classes: ${classCount[0].cnt} lớp`);
    console.log(`     → semester_enrollments: ${enrollCount[0].cnt} đăng ký`);
  }

  console.log('\n══════════════════════════════════════════════════');
  console.log('  🎉 XONG! Tiếp theo chạy:');
  console.log('  npx prisma db pull && npx prisma generate');
  console.log('══════════════════════════════════════════════════\n');

  await prisma.$disconnect();
}

main().catch(err => {
  console.error('\n❌ Lỗi:', err.message);
  process.exit(1);
});
