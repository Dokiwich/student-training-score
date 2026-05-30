import { Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
import { prisma } from '@student-score/database';

/**
 * DepartmentService
 * =================
 * Xử lý logic nghiệp vụ cấp Khoa:
 * - Lấy danh sách toàn bộ SV trong khoa (tất cả lớp)
 * - Thống kê tổng hợp cấp khoa
 * - So sánh thống kê qua nhiều học kỳ
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
  studentSubmittedAt: string | null;
}

@Injectable()
export class DepartmentService {

  private async getDepartmentId(userId: string): Promise<string> {
    const user = await prisma.users.findFirst({
      where: { id: userId },
      select: { role: true, department_id: true },
    });
    if (!user) throw new BadRequestException('Không tìm thấy người dùng');
    if (user.role !== 'DEPARTMENT') throw new ForbiddenException('Chỉ Trưởng khoa mới có quyền truy cập');
    if (!user.department_id) throw new BadRequestException('Tài khoản chưa được gắn với khoa nào');
    return user.department_id;
  }

  private async getSemester(semesterId?: string): Promise<{ id: string; name: string } | null> {
    if (semesterId) {
      return prisma.semesters.findUnique({ where: { id: semesterId }, select: { id: true, name: true } });
    }
    return prisma.semesters.findFirst({ where: { is_active: 1 }, orderBy: { created_at: 'desc' }, select: { id: true, name: true } });
  }

  /** Tính trạng thái học kỳ theo thời gian thực */
  private computeStatus(s: { start_date: Date; end_date: Date; student_deadline: Date; class_committee_deadline: Date; advisor_deadline: Date; school_deadline: Date }): string {
    const now = new Date();
    if (now < new Date(s.start_date)) return 'UPCOMING';
    if (now < new Date(s.student_deadline)) return 'STUDENT_SCORING';
    if (now < new Date(s.class_committee_deadline)) return 'CLASS_REVIEWING';
    if (now < new Date(s.advisor_deadline)) return 'ADVISOR_REVIEWING';
    if (now < new Date(s.school_deadline)) return 'SCHOOL_REVIEWING';
    if (now <= new Date(s.end_date)) return 'FINALIZED';
    return 'LOCKED';
  }

  /** Lấy danh sách tất cả học kỳ */
  async getSemesters() {
    const semesters = await prisma.semesters.findMany({
      orderBy: [{ start_date: 'desc' }],
      select: { id: true, code: true, name: true, academic_year: true, semester_number: true, start_date: true, end_date: true, student_deadline: true, class_committee_deadline: true, advisor_deadline: true, school_deadline: true, is_active: true, status: true },
    });

    // Auto-compute & sync status
    const updated = await Promise.all(semesters.map(async (s) => {
      const computed = this.computeStatus(s);
      if (computed !== s.status) {
        await prisma.semesters.update({ where: { id: s.id }, data: { status: computed as any } });
        return { ...s, status: computed };
      }
      return s;
    }));

    return { message: 'Lấy danh sách học kỳ thành công', data: updated };
  }

  /** Lấy toàn bộ sinh viên trong khoa */
  async getStudentsByDepartment(userId: string, semesterId?: string) {
    const departmentId = await this.getDepartmentId(userId);
    const semester = await this.getSemester(semesterId);
    if (!semester) return { message: 'Không tìm thấy học kỳ', data: [], department: null };

    const department = await prisma.departments.findUnique({ where: { id: departmentId }, select: { id: true, code: true, name: true } });

    const enrollments = await prisma.semester_enrollments.findMany({
      where: {
        semester_id: semester.id, is_active: 1,
        classes: { department_id: departmentId, is_active: 1 },
        users: { role: { in: ['STUDENT', 'CLASS_COMMITTEE'] }, is_active: 1 },
      },
      select: {
        users: { select: { id: true, student_id: true, full_name: true } },
        classes: { select: { code: true, name: true } },
        scoring_sheets: {
          select: { id: true, status: true, student_total: true, class_total: true, advisor_total: true, final_total: true, classification: true, student_submitted_at: true, class_reviewed_at: true, advisor_approved_at: true },
        },
      },
      orderBy: [{ classes: { code: 'asc' } }, { users: { full_name: 'asc' } }],
    });

    const data: DeptStudent[] = enrollments.map((e) => {
      const s = e.users; const c = e.classes; const sheet = e.scoring_sheets || null;
      return {
        id: s.id, studentCode: s.student_id, name: s.full_name, className: c.name, classCode: c.code,
        status: sheet?.status || 'NO_SHEET',
        studentTotal: sheet?.student_total != null ? Number(sheet.student_total) : null,
        classTotal: sheet?.class_total != null ? Number(sheet.class_total) : null,
        advisorTotal: sheet?.advisor_total != null ? Number(sheet.advisor_total) : null,
        finalTotal: sheet?.final_total != null ? Number(sheet.final_total) : null,
        classification: sheet?.classification || null,
        studentSubmittedAt: sheet?.student_submitted_at?.toISOString() || null,
      };
    });

    return { message: 'Lấy danh sách sinh viên toàn khoa thành công', data, department, semester };
  }

  /** Thống kê tổng hợp cấp khoa */
  async getDepartmentStats(userId: string, semesterId?: string) {
    const result = await this.getStudentsByDepartment(userId, semesterId);
    const students = result.data;

    const total = students.length;
    const submitted = students.filter(s => s.status !== 'NO_SHEET' && s.status !== 'DRAFT').length;
    const finalized = students.filter(s => ['ADVISOR_APPROVED', 'FINALIZED', 'SCHOOL_APPROVED'].includes(s.status)).length;

    const byClassification: Record<string, number> = {};
    students.forEach(s => { const cls = s.classification || 'NONE'; byClassification[cls] = (byClassification[cls] || 0) + 1; });

    const scoredStudents = students.filter(s => s.finalTotal != null || s.advisorTotal != null);
    const avgScore = scoredStudents.length > 0 ? scoredStudents.reduce((sum, s) => sum + (s.finalTotal || s.advisorTotal || 0), 0) / scoredStudents.length : 0;

    const byClass: Record<string, { className: string; classCode: string; total: number; submitted: number; finalized: number; avgScore: number; byClassification: Record<string, number> }> = {};
    students.forEach(s => {
      if (!byClass[s.classCode]) byClass[s.classCode] = { className: s.className, classCode: s.classCode, total: 0, submitted: 0, finalized: 0, avgScore: 0, byClassification: {} };
      const c = byClass[s.classCode];
      c.total++;
      if (s.status !== 'NO_SHEET' && s.status !== 'DRAFT') c.submitted++;
      if (['ADVISOR_APPROVED', 'FINALIZED', 'SCHOOL_APPROVED'].includes(s.status)) c.finalized++;
      const cls = s.classification || 'NONE'; c.byClassification[cls] = (c.byClassification[cls] || 0) + 1;
    });

    Object.values(byClass).forEach(c => {
      const cs = students.filter(s => s.classCode === c.classCode && (s.finalTotal != null || s.advisorTotal != null));
      c.avgScore = cs.length > 0 ? Number((cs.reduce((sum, s) => sum + (s.finalTotal || s.advisorTotal || 0), 0) / cs.length).toFixed(1)) : 0;
    });

    // Thống kê theo tháng
    const byMonth: Record<string, number> = {};
    students.forEach(s => {
      if (s.studentSubmittedAt) {
        const d = new Date(s.studentSubmittedAt);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        byMonth[key] = (byMonth[key] || 0) + 1;
      }
    });

    return {
      message: 'Thống kê khoa thành công', department: result.department, semester: result.semester,
      stats: {
        total, submitted, finalized, avgScore: Number(avgScore.toFixed(1)), byClassification,
        byClass: Object.values(byClass).sort((a, b) => a.classCode.localeCompare(b.classCode)),
        byMonth: Object.entries(byMonth).sort(([a], [b]) => a.localeCompare(b)).map(([month, count]) => ({ month, count })),
      },
    };
  }

  /** So sánh thống kê qua 3 học kỳ gần nhất */
  async getStatsComparison(userId: string) {
    const semesters = await prisma.semesters.findMany({ orderBy: { start_date: 'desc' }, take: 3, select: { id: true, name: true, code: true } });
    const results = [];
    for (const sem of semesters.reverse()) {
      const stats = await this.getDepartmentStats(userId, sem.id);
      results.push({ semesterId: sem.id, semesterName: sem.name, semesterCode: sem.code, byClassification: stats.stats.byClassification, total: stats.stats.total, avgScore: stats.stats.avgScore });
    }
    return { message: 'So sánh thống kê qua các học kỳ', data: results };
  }
}
