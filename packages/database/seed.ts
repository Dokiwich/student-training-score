import { PrismaClient, users_role } from './src/generated/client';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...\n');

  // =============================================
  // 1. DEPARTMENTS
  // =============================================
  const deptCNTT_id = randomUUID();
  const deptNN_id = randomUUID();

  await prisma.departments.createMany({
    data: [
      { id: deptCNTT_id, code: 'CNTT', name: 'Khoa Công Nghệ Thông Tin' },
      { id: deptNN_id, code: 'NN', name: 'Khoa Ngoại Ngữ' },
    ],
    skipDuplicates: true,
  });
  console.log('✅ Departments created');

  // =============================================
  // 2. CLASSES
  // =============================================
  const class23av_id = randomUUID();
  const class23bn_id = randomUUID();

  await prisma.classes.createMany({
    data: [
      { id: class23av_id, code: '23av', name: 'Lớp 23AV', department_id: deptCNTT_id, academic_year: '2023-2024' },
      { id: class23bn_id, code: '23bn', name: 'Lớp 23BN', department_id: deptNN_id, academic_year: '2023-2024' },
    ],
    skipDuplicates: true,
  });
  console.log('✅ Classes created');

  // =============================================
  // 3. USERS (hash passwords)
  // =============================================
  const studentPass = await bcrypt.hash('123456', 10);
  const deptPass = await bcrypt.hash('dept123', 10);
  const adminPass = await bcrypt.hash('admin', 10);

  // Admin
  const adminId = randomUUID();
  await prisma.users.create({
    data: {
      id: adminId,
      email: 'admin@edu.vn',
      password_hash: adminPass,
      full_name: 'Quản Trị Viên',
      role: 'SCHOOL_ADMIN',
      student_id: null,
    }
  });
  console.log('✅ Admin created: admin@edu.vn / admin');

  // Department user (Khoa CNTT)
  const deptCNTT_userId = randomUUID();
  await prisma.users.create({
    data: {
      id: deptCNTT_userId,
      email: 'khoa.cntt@university.edu.vn',
      password_hash: deptPass,
      full_name: 'Khoa CNTT',
      role: 'DEPARTMENT',
      department_id: deptCNTT_id,
      student_id: null,
    }
  });
  console.log('✅ Department user created: khoa.cntt@university.edu.vn / dept123');

  // Advisor (CVHT) for class 23av
  const advisor23av_id = randomUUID();
  await prisma.users.create({
    data: {
      id: advisor23av_id,
      email: 'cv.23av@edu.vn',
      password_hash: studentPass,
      full_name: 'Cố Vấn Lớp 23AV',
      role: 'ADVISOR',
      department_id: deptCNTT_id,
      student_id: null,
    }
  });
  await prisma.class_roles.create({
    data: {
      id: randomUUID(),
      user_id: advisor23av_id,
      class_id: class23av_id,
      role_type: 'ADVISOR',
      start_date: new Date(),
    }
  });
  console.log('✅ Advisor created: cv.23av@edu.vn / 123456');

  // BCS (Class Committee / MONITOR) for class 23av
  const bcs23av_id = randomUUID();
  await prisma.users.create({
    data: {
      id: bcs23av_id,
      email: 'bcs.23av@edu.vn',
      password_hash: studentPass,
      full_name: 'Ban Cán Sự Lớp 23AV',
      role: 'CLASS_COMMITTEE',
      department_id: deptCNTT_id,
      student_id: null,
    }
  });
  await prisma.class_roles.create({
    data: {
      id: randomUUID(),
      user_id: bcs23av_id,
      class_id: class23av_id,
      role_type: 'MONITOR',
      start_date: new Date(),
    }
  });
  console.log('✅ Class Committee created: bcs.23av@edu.vn / 123456');

  // Students for class 23av
  const studentIds: string[] = [];
  for (let i = 1; i <= 5; i++) {
    const sid = `23av${String(i).padStart(3, '0')}`;
    const studentId = randomUUID();
    studentIds.push(studentId);
    await prisma.users.create({
      data: {
        id: studentId,
        student_id: sid,
        email: `${sid}@student.edu.vn`,
        password_hash: studentPass,
        full_name: `Sinh Viên ${sid}`,
        role: 'STUDENT',
        department_id: deptCNTT_id,
      }
    });
  }
  console.log('✅ 5 Students created: 23av001-005 / 123456');

  // =============================================
  // 4. SEMESTER
  // =============================================
  const semesterId = randomUUID();
  await prisma.semesters.create({
    data: {
      id: semesterId,
      code: 'HK1-2025',
      name: 'Học kỳ 1',
      academic_year: '2025-2026',
      semester_number: 1,
      start_date: new Date('2025-08-01'),
      end_date: new Date('2026-12-31'),
      student_deadline: new Date('2026-10-15'),
      class_committee_deadline: new Date('2026-10-30'),
      advisor_deadline: new Date('2026-11-15'),
      school_deadline: new Date('2026-12-15'),
      status: 'STUDENT_SCORING',
      is_active: 1,
    }
  });
  console.log('✅ Semester created: HK1-2025 (active, is_active=1)');

  // =============================================
  // 5. SEMESTER ENROLLMENTS (gắn SV + BCS + CVHT vào HK)
  // =============================================
  // Enroll 5 students
  for (const sId of studentIds) {
    await prisma.semester_enrollments.create({
      data: {
        id: randomUUID(),
        user_id: sId,
        semester_id: semesterId,
        class_id: class23av_id,
        is_active: 1,
      }
    });
  }
  // Enroll BCS
  await prisma.semester_enrollments.create({
    data: {
      id: randomUUID(),
      user_id: bcs23av_id,
      semester_id: semesterId,
      class_id: class23av_id,
      is_active: 1,
    }
  });
  // Enroll Advisor
  await prisma.semester_enrollments.create({
    data: {
      id: randomUUID(),
      user_id: advisor23av_id,
      semester_id: semesterId,
      class_id: class23av_id,
      is_active: 1,
    }
  });
  console.log('✅ Semester enrollments created (5 SV + BCS + CVHT)');

  // =============================================
  // 6. CRITERIA VERSION + CATEGORIES + CRITERIA
  // =============================================
  const versionId = randomUUID();
  await prisma.criteria_versions.create({
    data: {
      id: versionId,
      semester_id: semesterId,
      version: 1,
      is_active: 1,
      applied_at: new Date(),
    }
  });
  console.log('✅ Criteria version created');

  // Categories (4 mục chính theo quy chế ĐGRL)
  const catA_id = randomUUID();
  const catB_id = randomUUID();
  const catC_id = randomUUID();
  const catD_id = randomUUID();

  await prisma.criteria_categories.createMany({
    data: [
      { id: catA_id, criteria_version_id: versionId, code: 'I', name: 'Ý thức tham gia học tập', max_score: 20, sort_order: 1 },
      { id: catB_id, criteria_version_id: versionId, code: 'II', name: 'Ý thức chấp hành nội quy, quy chế', max_score: 25, sort_order: 2 },
      { id: catC_id, criteria_version_id: versionId, code: 'III', name: 'Ý thức tham gia hoạt động chính trị - xã hội', max_score: 20, sort_order: 3 },
      { id: catD_id, criteria_version_id: versionId, code: 'IV', name: 'Ý thức công dân trong quan hệ cộng đồng', max_score: 25, sort_order: 4 },
    ],
  });
  console.log('✅ 4 Criteria categories created');

  // Criteria (tiêu chí mẫu cho mỗi mục)
  // Mục I - Ý thức tham gia học tập
  await prisma.criteria.createMany({
    data: [
      { category_id: catA_id, code: 'I.1', content: 'Đi học đầy đủ, đúng giờ', point: 5, sort_order: 1, is_active: 1 },
      { category_id: catA_id, code: 'I.2', content: 'Chuẩn bị bài trước khi đến lớp', point: 5, sort_order: 2, is_active: 1 },
      { category_id: catA_id, code: 'I.3', content: 'Hoàn thành đầy đủ các bài tập', point: 5, sort_order: 3, is_active: 1 },
      { category_id: catA_id, code: 'I.4', content: 'Tích cực phát biểu xây dựng bài', point: 5, sort_order: 4, is_active: 1 },
    ],
  });

  // Mục II - Ý thức chấp hành nội quy
  await prisma.criteria.createMany({
    data: [
      { category_id: catB_id, code: 'II.1', content: 'Chấp hành tốt quy chế, nội quy của trường', point: 5, sort_order: 1, is_active: 1 },
      { category_id: catB_id, code: 'II.2', content: 'Đóng học phí đầy đủ, đúng hạn', point: 5, sort_order: 2, is_active: 1 },
      { category_id: catB_id, code: 'II.3', content: 'Giữ gìn vệ sinh, bảo vệ tài sản nhà trường', point: 5, sort_order: 3, is_active: 1 },
      { category_id: catB_id, code: 'II.4', content: 'Không vi phạm pháp luật, nội quy ký túc xá', point: 5, sort_order: 4, is_active: 1 },
      { category_id: catB_id, code: 'II.5', content: 'Không gian lận thi cử', point: 5, sort_order: 5, is_active: 1 },
    ],
  });

  // Mục III - Ý thức tham gia hoạt động
  await prisma.criteria.createMany({
    data: [
      { category_id: catC_id, code: 'III.1', content: 'Tham gia các hoạt động Đoàn, Hội', point: 5, sort_order: 1, is_active: 1 },
      { category_id: catC_id, code: 'III.2', content: 'Tham gia hoạt động tình nguyện', point: 5, sort_order: 2, is_active: 1 },
      { category_id: catC_id, code: 'III.3', content: 'Tham gia hoạt động văn nghệ, thể thao', point: 5, sort_order: 3, is_active: 1 },
      { category_id: catC_id, code: 'III.4', content: 'Tham gia câu lạc bộ, đội nhóm', point: 5, sort_order: 4, is_active: 1 },
    ],
  });

  // Mục IV - Ý thức công dân
  await prisma.criteria.createMany({
    data: [
      { category_id: catD_id, code: 'IV.1', content: 'Có tinh thần đoàn kết, giúp đỡ bạn bè', point: 5, sort_order: 1, is_active: 1 },
      { category_id: catD_id, code: 'IV.2', content: 'Tham gia phòng chống tệ nạn xã hội', point: 5, sort_order: 2, is_active: 1 },
      { category_id: catD_id, code: 'IV.3', content: 'Có ý thức bảo vệ môi trường', point: 5, sort_order: 3, is_active: 1 },
      { category_id: catD_id, code: 'IV.4', content: 'Tham gia hiến máu nhân đạo', point: 5, sort_order: 4, is_active: 1 },
      { category_id: catD_id, code: 'IV.5', content: 'Được biểu dương, khen thưởng', point: 5, sort_order: 5, is_active: 1 },
    ],
  });
  console.log('✅ 18 Criteria created across 4 categories');

  // =============================================
  // DONE
  // =============================================
  console.log('\n🎉 Seed completed successfully!');
  console.log('\n📋 Test accounts:');
  console.log('  Admin:      admin@edu.vn / admin');
  console.log('  Khoa:       khoa.cntt@university.edu.vn / dept123');
  console.log('  CVHT:       cv.23av@edu.vn / 123456');
  console.log('  BCS:        bcs.23av@edu.vn / 123456');
  console.log('  Sinh viên:  23av001 / 123456 (hoặc email: 23av001@student.edu.vn)');
  console.log('\n📋 Data:');
  console.log('  2 Khoa, 2 Lớp, 1 Học kỳ (active), 7 enrollments');
  console.log('  1 Criteria version, 4 Categories, 18 Criteria');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
