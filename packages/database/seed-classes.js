const { PrismaClient } = require('./src/generated/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

// ═══════════════════════════════════════
// CẤU HÌNH DỮ LIỆU
// ═══════════════════════════════════════
const DEPARTMENTS = [
  {
    code: 'NN',
    name: 'Khoa Ngoại ngữ',
    classes: [
      { code: '22AV1101', name: 'Lớp 22AV1101', studentCount: 16 },
      { code: '23AV', name: 'Lớp 23AV', studentCount: 19 },
      { code: '24AV', name: 'Lớp 24AV', studentCount: 26 },
      { code: '25AV', name: 'Lớp 25AV', studentCount: 60 },
      { code: '23TQ', name: 'Lớp 23TQ', studentCount: 16 },
      { code: '24TQ', name: 'Lớp 24TQ', studentCount: 19 },
      { code: '25TQ', name: 'Lớp 25TQ', studentCount: 58 },
    ],
  },
  {
    code: 'CNTT',
    name: 'Khoa Công nghệ Thông tin',
    classes: [
      { code: '22IT1101', name: 'Lớp 22IT1101', studentCount: 28 },
      { code: '23IT', name: 'Lớp 23IT', studentCount: 25 },
      { code: '24IT', name: 'Lớp 24IT', studentCount: 21 },
      { code: '25IT', name: 'Lớp 25IT', studentCount: 6 },
      { code: '25IT1', name: 'Lớp 25IT1', studentCount: 30 },
    ],
  },
];

const DEFAULT_PASSWORD = '123456';
const SEMESTER_ID = 'SEM_01';

function makeId(prefix, suffix) {
  return `${prefix}_${suffix}`.substring(0, 36);
}

const HO = ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Huỳnh', 'Phan', 'Vũ', 'Võ', 'Đặng', 'Bùi', 'Đỗ', 'Hồ', 'Ngô', 'Dương', 'Lý'];
const DEM = ['Văn', 'Thị', 'Đức', 'Minh', 'Quốc', 'Hữu', 'Thanh', 'Ngọc', 'Hoàng', 'Xuân', 'Bảo', 'Phúc'];
const TEN = ['An', 'Bình', 'Chi', 'Dũng', 'Em', 'Giang', 'Hà', 'Hùng', 'Khoa', 'Linh', 'Mai', 'Nam', 'Oanh', 'Phong', 'Quân', 'Sơn', 'Tâm', 'Uyên', 'Vinh', 'Yến', 'Tuấn', 'Hương', 'Đạt', 'Long', 'Thảo', 'Trang', 'Hải', 'Hiếu', 'Trung', 'Duy'];

function randomName(idx) {
  return `${HO[idx % HO.length]} ${DEM[(idx * 3 + 7) % DEM.length]} ${TEN[(idx * 7 + 13) % TEN.length]}`;
}

async function main() {
  console.log('🚀 Bắt đầu đổ dữ liệu lớp học...\n');

  const hashedPassword = await bcrypt.hash(DEFAULT_PASSWORD, 10);
  let totalStudents = 0;
  let totalClasses = 0;

  for (const dept of DEPARTMENTS) {
    console.log(`📌 Khoa: ${dept.name} (${dept.code})`);
    const deptId = makeId('DEPT', dept.code);

    await prisma.departments.upsert({
      where: { code: dept.code },
      update: { name: dept.name },
      create: { id: deptId, code: dept.code, name: dept.name },
    });

    // ĐỌC LẠI ID THỰC TỪ DB (tránh lỗi FK khi ID đã tồn tại khác với deptId tính trước)
    const actualDept = await prisma.departments.findUnique({ where: { code: dept.code } });
    const realDeptId = actualDept.id;

    for (const cls of dept.classes) {
      totalClasses++;
      const classId = makeId('CLS', cls.code);

      await prisma.classes.upsert({
        where: { code: cls.code },
        update: { name: cls.name, department_id: realDeptId },
        create: { id: classId, code: cls.code, name: cls.name, academic_year: '2025-2026', department_id: realDeptId },
      });

      // BAN CÁN SỰ
      const bcsEmail = `bcs.${cls.code.toLowerCase()}@edu.vn`;
      const bcsStudentId = `BCS${cls.code}`;
      const bcsUserId = makeId('U_BCS', cls.code);

      await prisma.users.upsert({
        where: { email: bcsEmail },
        update: { password_hash: hashedPassword, class_id: classId, department_id: realDeptId },
        create: {
          id: bcsUserId, student_id: bcsStudentId, email: bcsEmail, password_hash: hashedPassword,
          full_name: `BCS ${cls.code}`, role: 'CLASS_COMMITTEE', department_id: realDeptId, class_id: classId,
        },
      });

      // CỐ VẤN
      const cvEmail = `cv.${cls.code.toLowerCase()}@edu.vn`;
      const cvUserId = makeId('U_CV', cls.code);

      await prisma.users.upsert({
        where: { email: cvEmail },
        update: { password_hash: hashedPassword, department_id: realDeptId },
        create: {
          id: cvUserId, email: cvEmail, password_hash: hashedPassword,
          full_name: `CVHT ${cls.code}`, role: 'ADVISOR', department_id: realDeptId,
        },
      });

      // class_roles cho CVHT
      const crId = makeId('CR', cls.code);
      try {
        await prisma.class_roles.upsert({
          where: { user_id_class_id_role_type: { user_id: cvUserId, class_id: classId, role_type: 'ADVISOR' } },
          update: {},
          create: { id: crId, user_id: cvUserId, class_id: classId, role_type: 'ADVISOR', start_date: new Date('2025-09-01') },
        });
      } catch (e) {
        // ignore duplicate
      }

      // SINH VIÊN
      for (let i = 1; i <= cls.studentCount; i++) {
        totalStudents++;
        const svIdx = String(i).padStart(3, '0');
        const studentCode = `${cls.code}${svIdx}`;
        const svEmail = `${studentCode.toLowerCase()}@student.edu.vn`;
        const svUserId = makeId('U_SV', `${cls.code}_${svIdx}`);

        await prisma.users.upsert({
          where: { email: svEmail },
          update: { password_hash: hashedPassword, class_id: classId, department_id: realDeptId },
          create: {
            id: svUserId, student_id: studentCode, email: svEmail, password_hash: hashedPassword,
            full_name: randomName(totalStudents), role: 'STUDENT', department_id: realDeptId, class_id: classId,
          },
        });

        // Phiếu điểm
        const sheetId = makeId('SH', `${cls.code}_${svIdx}`);
        try {
          await prisma.scoring_sheets.upsert({
            where: { student_id_semester_id: { student_id: svUserId, semester_id: SEMESTER_ID } },
            update: {},
            create: { id: sheetId, student_id: svUserId, semester_id: SEMESTER_ID, class_id: classId, status: 'DRAFT' },
          });
        } catch (e) {
          // ignore if semester doesn't exist
        }
      }

      console.log(`   ✅ ${cls.code}: ${cls.studentCount} SV + 1 BCS + 1 CVHT`);
    }
    console.log('');
  }

  console.log(`\n🎉 Hoàn tất! ${totalClasses} lớp, ${totalStudents} sinh viên.`);
  console.log(`   Mật khẩu tất cả: ${DEFAULT_PASSWORD}`);
}

main()
  .catch((e) => { console.error('❌ Lỗi:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
