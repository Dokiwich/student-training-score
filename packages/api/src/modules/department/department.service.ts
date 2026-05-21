import { Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
import { prisma } from '@student-score/database';

/**
 * DepartmentService
 * =================
 * Xử lý logic nghiệp vụ cấp Khoa:
 * - Lấy danh sách toàn bộ SV trong khoa (tất cả lớp)
 * - Thống kê tổng hợp cấp khoa
 * 
 * 3NF path:
 *   users(role=DEPARTMENT).department_id 
 *     → departments 
 *       → classes(department_id)
 *         → semester_enrollments(class_id)
 *           → scoring_sheets(enrollment_id)
 */

interface DeptStudent {
  id: string;
  studentCode: string | null;
  name: string;
  className: string;
  classCode: string;
  status: string;
  studentTotal: number | null;
  classTotal: number | null;
  advisorTotal: number | null;
  finalTotal: number | null;
  classification: string | null;
}

@Injectable()
export class DepartmentService {

  /**
   * Lấy department_id của user đang đăng nhập (phải có role DEPARTMENT)
   */
  private async getDepartmentId(userId: string): Promise<string> {
    const user = await prisma.users.findFirst({
      where: { id: userId },
      select: { role: true, department_id: true },
    });

    if (!user) {
      throw new BadRequestException('Không tìm thấy người dùng');
    }

    if (user.role !== 'DEPARTMENT') {
      throw new ForbiddenException('Chỉ Trưởng khoa mới có quyền truy cập');
    }

    if (!user.department_id) {
      throw new BadRequestException('Tài khoản chưa được gắn với khoa nào');
    }

    return user.department_id;
  }

  /**
   * Lấy active semester
   */
  private async getActiveSemester(): Promise<{ id: string; name: string } | null> {
    return prisma.semesters.findFirst({
      where: { is_active: 1 },
      orderBy: { created_at: 'desc' },
      select: { id: true, name: true },
    });
  }

  /**
   * Lấy toàn bộ sinh viên trong khoa với điểm rèn luyện
   */
  async getStudentsByDepartment(userId: string) {
    const departmentId = await this.getDepartmentId(userId);
    const activeSemester = await this.getActiveSemester();

    if (!activeSemester) {
      return { message: 'Không tìm thấy học kỳ đang hoạt động', data: [], department: null };
    }

    // Lấy thông tin khoa
    const department = await prisma.departments.findUnique({
      where: { id: departmentId },
      select: { id: true, code: true, name: true },
    });

    // 3NF query chain: department → classes → semester_enrollments → scoring_sheets
    const enrollments = await prisma.semester_enrollments.findMany({
      where: {
        semester_id: activeSemester.id,
        is_active: 1,
        classes: {
          department_id: departmentId,
          is_active: 1,
        },
        users: {
          role: { in: ['STUDENT', 'CLASS_COMMITTEE'] },
          is_active: 1,
        },
      },
      select: {
        users: {
          select: {
            id: true,
            student_id: true,
            full_name: true,
          },
        },
        classes: {
          select: {
            code: true,
            name: true,
          },
        },
        scoring_sheets: {
          select: {
            id: true,
            status: true,
            student_total: true,
            class_total: true,
            advisor_total: true,
            final_total: true,
            classification: true,
            student_submitted_at: true,
            class_reviewed_at: true,
            advisor_approved_at: true,
          },
        },
      },
      orderBy: [
        { classes: { code: 'asc' } },
        { users: { full_name: 'asc' } },
      ],
    });

    const data: DeptStudent[] = enrollments.map((e) => {
      const s = e.users;
      const c = e.classes;
      const sheet = e.scoring_sheets || null;
      return {
        id: s.id,
        studentCode: s.student_id,
        name: s.full_name,
        className: c.name,
        classCode: c.code,
        status: sheet?.status || 'NO_SHEET',
        studentTotal: sheet?.student_total != null ? Number(sheet.student_total) : null,
        classTotal: sheet?.class_total != null ? Number(sheet.class_total) : null,
        advisorTotal: sheet?.advisor_total != null ? Number(sheet.advisor_total) : null,
        finalTotal: sheet?.final_total != null ? Number(sheet.final_total) : null,
        classification: sheet?.classification || null,
      };
    });

    return {
      message: 'Lấy danh sách sinh viên toàn khoa thành công',
      data,
      department,
      semester: activeSemester,
    };
  }

  /**
   * Thống kê tổng hợp cấp khoa
   */
  async getDepartmentStats(userId: string) {
    const result = await this.getStudentsByDepartment(userId);
    const students = result.data;

    const total = students.length;
    const submitted = students.filter(s => s.status !== 'NO_SHEET' && s.status !== 'DRAFT').length;
    const finalized = students.filter(s => 
      s.status === 'ADVISOR_APPROVED' || s.status === 'FINALIZED' || 
      s.status === 'SCHOOL_APPROVED'
    ).length;

    // Thống kê xếp loại
    const byClassification: Record<string, number> = {};
    students.forEach(s => {
      const cls = s.classification || 'NONE';
      byClassification[cls] = (byClassification[cls] || 0) + 1;
    });

    // Điểm trung bình toàn khoa
    const scoredStudents = students.filter(s => s.finalTotal != null || s.advisorTotal != null);
    const avgScore = scoredStudents.length > 0
      ? (scoredStudents.reduce((sum, s) => sum + (s.finalTotal || s.advisorTotal || 0), 0) / scoredStudents.length)
      : 0;

    // Thống kê theo từng lớp
    const byClass: Record<string, {
      className: string;
      classCode: string;
      total: number;
      submitted: number;
      finalized: number;
      avgScore: number;
      byClassification: Record<string, number>;
    }> = {};

    students.forEach(s => {
      if (!byClass[s.classCode]) {
        byClass[s.classCode] = {
          className: s.className,
          classCode: s.classCode,
          total: 0,
          submitted: 0,
          finalized: 0,
          avgScore: 0,
          byClassification: {},
        };
      }
      const c = byClass[s.classCode];
      c.total++;
      if (s.status !== 'NO_SHEET' && s.status !== 'DRAFT') c.submitted++;
      if (s.status === 'ADVISOR_APPROVED' || s.status === 'FINALIZED' || s.status === 'SCHOOL_APPROVED') c.finalized++;
      const cls = s.classification || 'NONE';
      c.byClassification[cls] = (c.byClassification[cls] || 0) + 1;
    });

    // Tính điểm TB từng lớp
    Object.values(byClass).forEach(c => {
      const classStudents = students.filter(s => s.classCode === c.classCode && (s.finalTotal != null || s.advisorTotal != null));
      c.avgScore = classStudents.length > 0
        ? Number((classStudents.reduce((sum, s) => sum + (s.finalTotal || s.advisorTotal || 0), 0) / classStudents.length).toFixed(1))
        : 0;
    });

    return {
      message: 'Thống kê khoa thành công',
      department: result.department,
      semester: result.semester,
      stats: {
        total,
        submitted,
        finalized,
        avgScore: Number(avgScore.toFixed(1)),
        byClassification,
        byClass: Object.values(byClass).sort((a, b) => a.classCode.localeCompare(b.classCode)),
      },
    };
  }
}
