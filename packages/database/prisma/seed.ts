import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
const prisma = new PrismaClient();

async function main() {
  console.log('Đang khởi động mũi khoan bơm dữ liệu...');

  // 1. Tạo dữ liệu gốc (Kỳ học, Khoa, Lớp, User)
  const semester = await prisma.semesters.upsert({
    where: { code: 'HK1_2023_2024' },
    update: {},
    create: {
      id: 'SEM_01',
      code: 'HK1_2023_2024',
      name: 'Học kỳ 1 năm học 2023-2024',
      academic_year: '2023-2024',
      semester_number: 1,
      start_date: new Date('2023-09-01'),
      end_date: new Date('2024-01-31'),
      student_deadline: new Date('2024-01-15'),
      class_committee_deadline: new Date('2024-01-20'),
      advisor_deadline: new Date('2024-01-25'),
      school_deadline: new Date('2024-01-31'),
    }
  });

  const department = await prisma.departments.upsert({
    where: { code: 'CNTT' },
    update: {},
    create: {
      id: 'DEPT_01',
      code: 'CNTT',
      name: 'Khoa Công nghệ thông tin',
    }
  });

  const classObj = await prisma.classes.upsert({
    where: { code: '12DTH11' },
    update: {},
    create: {
      id: 'CLASS_01',
      code: '12DTH11',
      name: 'Đại học Tin học 11',
      academic_year: '2023-2024',
      department_id: department.id,
    }
  });

  const hashed123 = await bcrypt.hash('123', 10);
  const user1 = await prisma.users.upsert({
    where: { email: '123@student.edu.vn' },
    update: { password_hash: hashed123, role: 'STUDENT', student_id: '123' },
    create: {
      id: 'USER_123',
      student_id: '123',
      email: '123@student.edu.vn',
      password_hash: hashed123,
      full_name: 'Sinh viên 123',
      role: 'STUDENT',
      department_id: department.id,
      class_id: classObj.id,
    }
  });

  const hashed456 = await bcrypt.hash('456', 10);
  const user2 = await prisma.users.upsert({
    where: { email: '456@student.edu.vn' },
    update: { password_hash: hashed456, role: 'CLASS_COMMITTEE', student_id: '456' },
    create: {
      id: 'USER_456',
      student_id: '456',
      email: '456@student.edu.vn',
      password_hash: hashed456,
      full_name: 'Lớp trưởng 456',
      role: 'CLASS_COMMITTEE',
      department_id: department.id,
      class_id: classObj.id,
    }
  });

  const hashed789 = await bcrypt.hash('789', 10);
  const user3 = await prisma.users.upsert({
    where: { email: '789@gv.edu.vn' },
    update: { password_hash: hashed789, role: 'ADVISOR', student_id: '789' },
    create: {
      id: 'USER_789',
      student_id: '789',
      email: '789@gv.edu.vn',
      password_hash: hashed789,
      full_name: 'Cố vấn 789',
      role: 'ADVISOR',
      department_id: department.id,
    }
  });

  // Gán cố vấn vào lớp qua class_roles
  await prisma.class_roles.upsert({
    where: { user_id_class_id_role_type: { user_id: user3.id, class_id: classObj.id, role_type: 'ADVISOR' } },
    update: {},
    create: {
      id: 'CR_ADVISOR_01',
      user_id: user3.id,
      class_id: classObj.id,
      role_type: 'ADVISOR',
      start_date: new Date('2023-09-01'),
    }
  });

  // 2. Tạo phiên bản tiêu chí và danh mục tiêu chí
  const cv = await prisma.criteria_versions.upsert({
    where: { semester_id_version: { semester_id: semester.id, version: 1 } },
    update: {},
    create: {
      id: 'CV_01',
      semester_id: semester.id,
      version: 1,
      applied_at: new Date('2023-09-01'),
    }
  });

  const category = await prisma.criteria_categories.upsert({
    where: { id: 'CAT_01' },
    update: {},
    create: {
      id: 'CAT_01',
      criteria_version_id: cv.id,
      code: 'C_01',
      name: 'Danh mục 1',
      max_score: 100,
    }
  });

  // 3. Tạo một tiêu chí mẫu
  await prisma.criteria.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      category_id: category.id,
      code: 'TC_01',
      content: 'Tham gia đầy đủ các buổi sinh hoạt chính trị, học tập nghị quyết',
      max_points: 10,
    },
  });

  // 4. Tạo một phiếu điểm nháp mẫu của sinh viên
  await prisma.scoring_sheets.upsert({
    where: { id: 'PHIEU_THAT_01' },
    update: {},
    create: {
      id: 'PHIEU_THAT_01',
      student_id: user1.id,
      semester_id: semester.id,
      class_id: classObj.id,
      status: 'DRAFT',
    },
  });

  console.log('🎉 Bơm dữ liệu thành công! Kho đạn đã nạp đầy.');
}

main()
  .catch((e) => {
    console.error('Lỗi trong quá trình bơm dữ liệu:', e);
    process.exit(1);
  })
  .finally(async () => {
    // Luôn nhớ đóng kết nối sau khi làm xong
    await prisma.$disconnect();
  });