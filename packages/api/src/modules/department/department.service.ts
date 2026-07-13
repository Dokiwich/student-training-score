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
      include: {
        user_roles: {
          include: { roles: true },
        },
      },
    });
    if (!user) throw new BadRequestException('Không tìm thấy người dùng');
    
    const isDepartment = user.user_roles.some(ur => ur.roles.code === 'DEPARTMENT' && ur.is_active === 1);
    if (!isDepartment) throw new ForbiddenException('Chỉ Khoa mới có quyền truy cập');
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
        users: { is_active: 1 },
      },
      select: {
        users: { select: { id: true, student_id: true, full_name: true } },
        classes: { select: { code: true, name: true } },
        scoring_sheets: {
          select: { id: true, status: true, classification_override: true, student_submitted_at: true, class_reviewed_at: true, advisor_approved_at: true,
            score_details: { select: { score_entries: { select: { scorer_role: true, score: true } } } },
          },
        },
      },
      orderBy: [{ classes: { code: 'asc' } }, { users: { full_name: 'asc' } }],
    });

    const getClassif = (score: number) => score >= 90 ? 'EXCELLENT' : score >= 80 ? 'VERY_GOOD' : score >= 65 ? 'GOOD' : score >= 50 ? 'AVERAGE' : score >= 35 ? 'WEAK' : 'POOR';

    const data: DeptStudent[] = enrollments.map((e) => {
      const s = e.users; const c = e.classes; const sheet = e.scoring_sheets || null;
      // ✅ 3NF: Compute totals at runtime
      let studentTotal: number | null = null, classTotal: number | null = null, advisorTotal: number | null = null, finalTotal: number | null = null;
      let classification: string | null = null;
      if (sheet && (sheet as any).score_details) {
        let sSum = 0, cSum = 0, aSum = 0;
        for (const d of (sheet as any).score_details) {
          const entries = d.score_entries || [];
          const sE = entries.find((x: any) => x.scorer_role === 'STUDENT');
          const cE = entries.find((x: any) => x.scorer_role === 'CLASS_COMMITTEE');
          const aE = entries.find((x: any) => x.scorer_role === 'ADVISOR');
          sSum += sE ? Number(sE.score) : 0;
          cSum += cE ? Number(cE.score) : (sE ? Number(sE.score) : 0);
          aSum += aE ? Number(aE.score) : (cE ? Number(cE.score) : (sE ? Number(sE.score) : 0));
        }
        studentTotal = Math.round(Math.min(100, Math.max(0, sSum)) * 10) / 10;
        classTotal = Math.round(Math.min(100, Math.max(0, cSum)) * 10) / 10;
        advisorTotal = Math.round(Math.min(100, Math.max(0, aSum)) * 10) / 10;
        finalTotal = advisorTotal;
        classification = (sheet as any).classification_override || getClassif(finalTotal);
      }
      return {
        id: s.id, studentCode: s.student_id, name: s.full_name, className: c.name, classCode: c.code,
        status: sheet?.status || 'NO_SHEET',
        studentTotal, classTotal, advisorTotal, finalTotal, classification,
        studentSubmittedAt: sheet?.student_submitted_at?.toISOString() || null,
      };
    });

    return { message: 'Lấy danh sách sinh viên toàn khoa thành công', data, department, semester };
  }

  /** Thống kê tổng hợp cấp khoa — ✅ FIX: Dùng DB Aggregation thay vì tải toàn bộ SV vào RAM */
  async getDepartmentStats(userId: string, semesterId?: string) {
    const departmentId = await this.getDepartmentId(userId);
    const semester = await this.getSemester(semesterId);
    if (!semester) return { message: 'Không tìm thấy học kỳ', department: null, semester: null, stats: { total: 0, submitted: 0, finalized: 0, avgScore: 0, byClassification: {}, byClass: [], byMonth: [] } };

    const department = await prisma.departments.findUnique({ where: { id: departmentId }, select: { id: true, code: true, name: true } });

    // Điều kiện lọc chung cho tất cả query
    const enrollmentWhere = {
      semester_id: semester.id,
      is_active: 1,
      classes: { department_id: departmentId, is_active: 1 },
      users: { is_active: 1 },
    };

    // 1. Tổng số sinh viên
    const total = await prisma.semester_enrollments.count({ where: enrollmentWhere });

    // 2. Lấy scoring_sheets cho các enrollment thuộc khoa (chỉ lấy trường cần thiết)
    const sheets = await prisma.scoring_sheets.findMany({
      where: {
        semester_enrollments: enrollmentWhere,
      },
      select: {
        status: true,
        classification_override: true,
        student_submitted_at: true,
        score_details: {
          select: {
            score_entries: { select: { scorer_role: true, score: true } },
          },
        },
        semester_enrollments: {
          select: {
            classes: { select: { code: true, name: true } },
          },
        },
      },
    });

    // 3. Tính toán thống kê từ sheets (nhẹ hơn nhiều so với tải toàn bộ student data)
    let submitted = 0;
    let finalized = 0;
    const byClassification: Record<string, number> = {};
    const byMonth: Record<string, number> = {};
    const byClass: Record<string, { className: string; classCode: string; total: number; submitted: number; finalized: number; scores: number[]; byClassification: Record<string, number> }> = {};

    // Đếm các enrollment KHÔNG có sheet (NO_SHEET) theo lớp
    const enrollmentsWithSheet = await prisma.semester_enrollments.findMany({
      where: enrollmentWhere,
      select: {
        classes: { select: { code: true, name: true } },
        scoring_sheets: { select: { id: true } },
      },
    });

    // Init byClass từ toàn bộ enrollment
    for (const e of enrollmentsWithSheet) {
      const cc = e.classes.code;
      if (!byClass[cc]) {
        byClass[cc] = { className: e.classes.name, classCode: cc, total: 0, submitted: 0, finalized: 0, scores: [], byClassification: {} };
      }
      byClass[cc].total++;
      if (!e.scoring_sheets) {
        const cls = 'NONE';
        byClass[cc].byClassification[cls] = (byClass[cc].byClassification[cls] || 0) + 1;
        byClassification[cls] = (byClassification[cls] || 0) + 1;
      }
    }

    // Xử lý sheets
    const FINALIZED_STATUSES = ['ADVISOR_APPROVED', 'FINALIZED', 'SCHOOL_APPROVED'];
    let scoreSum = 0;
    let scoreCount = 0;

    const getClassifStats = (score: number) => score >= 90 ? 'EXCELLENT' : score >= 80 ? 'VERY_GOOD' : score >= 65 ? 'GOOD' : score >= 50 ? 'AVERAGE' : score >= 35 ? 'WEAK' : 'POOR';

    for (const s of sheets) {
      const isSubmitted = s.status !== 'DRAFT';
      const isFinalized = FINALIZED_STATUSES.includes(s.status);
      const classCode = s.semester_enrollments?.classes?.code || 'UNKNOWN';

      // ✅ 3NF: Compute totals at runtime
      let effectiveScore: number | null = null;
      let cls = 'NONE';
      if (s.score_details) {
        let aSum = 0;
        for (const d of s.score_details as any[]) {
          const entries = d.score_entries || [];
          const sE = entries.find((x: any) => x.scorer_role === 'STUDENT');
          const cE = entries.find((x: any) => x.scorer_role === 'CLASS_COMMITTEE');
          const aE = entries.find((x: any) => x.scorer_role === 'ADVISOR');
          aSum += aE ? Number(aE.score) : (cE ? Number(cE.score) : (sE ? Number(sE.score) : 0));
        }
        effectiveScore = Math.round(Math.min(100, Math.max(0, aSum)) * 10) / 10;
        cls = (s as any).classification_override || getClassifStats(effectiveScore);
      }

      if (isSubmitted) submitted++;
      if (isFinalized) finalized++;

      byClassification[cls] = (byClassification[cls] || 0) + 1;

      if (effectiveScore != null) {
        scoreSum += effectiveScore;
        scoreCount++;
      }

      if (byClass[classCode]) {
        if (isSubmitted) byClass[classCode].submitted++;
        if (isFinalized) byClass[classCode].finalized++;
        byClass[classCode].byClassification[cls] = (byClass[classCode].byClassification[cls] || 0) + 1;
        if (effectiveScore != null) byClass[classCode].scores.push(effectiveScore);
      }

      if (s.student_submitted_at) {
        const d = new Date(s.student_submitted_at);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        byMonth[key] = (byMonth[key] || 0) + 1;
      }
    }

    const avgScore = scoreCount > 0 ? Number((scoreSum / scoreCount).toFixed(1)) : 0;

    // Format byClass output (loại bỏ mảng scores tạm)
    const byClassOutput = Object.values(byClass)
      .map(c => ({
        className: c.className,
        classCode: c.classCode,
        total: c.total,
        submitted: c.submitted,
        finalized: c.finalized,
        avgScore: c.scores.length > 0 ? Number((c.scores.reduce((a, b) => a + b, 0) / c.scores.length).toFixed(1)) : 0,
        byClassification: c.byClassification,
      }))
      .sort((a, b) => a.classCode.localeCompare(b.classCode));

    return {
      message: 'Thống kê khoa thành công', department, semester,
      stats: {
        total, submitted, finalized, avgScore, byClassification,
        byClass: byClassOutput,
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
