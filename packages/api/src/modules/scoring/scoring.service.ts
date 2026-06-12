import { Injectable, BadRequestException } from '@nestjs/common';
import { prisma } from '@student-score/database';
import { randomUUID } from 'crypto';

// =============================================
// WORKFLOW STATUS CONSTANTS (Thay cho enum import)
// Map với cả 2 hệ thống: chi tiết (12 bước) & đơn giản (4 bước)
// =============================================
const WorkflowStatus = {
  // 4 bước đơn giản (Frontend dùng)
  DRAFT: 'DRAFT',
  SUBMITTED: 'STUDENT_SUBMITTED',
  CLASS_APPROVED: 'CLASS_REVIEWED',
  ADVISOR_APPROVED: 'ADVISOR_APPROVED',
} as const;

// ✅ MA TRẬN CHUYỂN TRẠNG THÁI (State Machine)
// Key: Role → Value: { requiredStatus, nextStatus }
const STATE_TRANSITIONS: Record<string, {
  requiredStatus: string;
  nextStatus: string;
  timestampField: string;
  currentStep: number;
  errorMessage: string;
}> = {
  STUDENT: {
    requiredStatus: WorkflowStatus.DRAFT,
    nextStatus: WorkflowStatus.SUBMITTED,
    timestampField: 'student_submitted_at',
    currentStep: 2,
    errorMessage: 'Sinh viên chỉ được nộp khi phiếu đang là Bản Nháp (DRAFT)',
  },
  CLASS_COMMITTEE: {
    requiredStatus: WorkflowStatus.SUBMITTED,
    nextStatus: WorkflowStatus.CLASS_APPROVED,
    timestampField: 'class_reviewed_at',
    currentStep: 3,
    errorMessage: 'Lớp trưởng chỉ được duyệt khi Sinh viên đã nộp (SUBMITTED)',
  },
  ADVISOR: {
    requiredStatus: WorkflowStatus.CLASS_APPROVED,
    nextStatus: WorkflowStatus.ADVISOR_APPROVED,
    timestampField: 'advisor_approved_at',
    currentStep: 4,
    errorMessage: 'Cố vấn chỉ được chốt khi Lớp trưởng đã duyệt (CLASS_APPROVED)',
  },
};


const SCORING_PERMISSIONS: Record<string, string> = {
  STUDENT: WorkflowStatus.DRAFT,
  CLASS_COMMITTEE: WorkflowStatus.SUBMITTED,
  ADVISOR: WorkflowStatus.CLASS_APPROVED,
};



@Injectable()
export class ScoringService {

  // =============================================
  // HELPER: Lấy enrollment từ semester_enrollments
  // =============================================
  private async resolveEnrollment(userId: string, semesterId: string): Promise<{ id: string; class_id: string } | null> {
    const enrollment = await prisma.semester_enrollments.findUnique({
      where: {
        user_id_semester_id: {
          user_id: userId,
          semester_id: semesterId,
        },
      },
      select: { id: true, class_id: true },
    });
    return enrollment || null;
  }

  // =============================================
  // HELPER: Tìm phiếu theo student_id (qua enrollment)
  // =============================================
  private async findSheetByStudent(studentId: string, semesterId?: string) {
    let targetSemesterId = semesterId;
    if (!targetSemesterId) {
      const activeSemester = await this.getActiveSemester();
      targetSemesterId = activeSemester?.id;
    }

    if (!targetSemesterId) return null;

    return prisma.scoring_sheets.findFirst({
      where: {
        semester_enrollments: {
          user_id: studentId,
          semester_id: targetSemesterId,
        },
      },
    });
  }

  // =============================================
  // HELPER: Lấy active semester
  // =============================================
  private async getActiveSemester(): Promise<{ id: string } | null> {
    return prisma.semesters.findFirst({
      where: { is_active: 1 },
      orderBy: { created_at: 'desc' },
      select: { id: true },
    });
  }

  // =============================================
  // HELPER: Lấy semester kèm thông tin deadline
  // =============================================
  private async getSemesterWithDeadlines(semesterId?: string) {
    const selectFields = {
      id: true,
      student_deadline: true,
      class_committee_deadline: true,
      advisor_deadline: true,
      school_deadline: true,
    };

    if (semesterId) {
      return prisma.semesters.findUnique({
        where: { id: semesterId },
        select: selectFields,
      });
    }
    return prisma.semesters.findFirst({
      where: { is_active: 1 },
      orderBy: { created_at: 'desc' },
      select: selectFields,
    });
  }

  // =============================================
  // HELPER: Kiểm tra hạn chót theo Role
  // =============================================
  private checkDeadline(
    role: string,
    semester: {
      student_deadline: Date | null;
      class_committee_deadline: Date | null;
      advisor_deadline: Date | null;
      school_deadline: Date | null;
    },
  ) {
    const now = new Date();
    const deadlineMap: Record<string, { deadline: Date | null; label: string }> = {
      STUDENT: {
        deadline: semester.student_deadline ? new Date(semester.student_deadline) : null,
        label: 'sinh viên tự chấm điểm',
      },
      CLASS_COMMITTEE: {
        deadline: semester.class_committee_deadline ? new Date(semester.class_committee_deadline) : null,
        label: 'Ban cán sự xét duyệt',
      },
      ADVISOR: {
        deadline: semester.advisor_deadline ? new Date(semester.advisor_deadline) : null,
        label: 'Cố vấn học tập phê duyệt',
      },
    };

    const config = deadlineMap[role];
    if (!config || !config.deadline) return;

    if (now > config.deadline) {
      const formatted = config.deadline.toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
      throw new BadRequestException(
        `Đã quá hạn ${config.label} (hạn chót: ${formatted}). ` +
        `Vui lòng liên hệ quản trị viên nếu cần gia hạn.`,
      );
    }
  }

  // =============================================
  // HELPER: Ghi log điều chỉnh điểm
  // =============================================
  private async logScoreAdjustment(
    scoreDetailId: string,
    adjustedById: string,
    oldScore: number,
    newScore: number,
    reason?: string,
  ) {
    if (oldScore === newScore) return;
    try {
      await prisma.score_adjustment_logs.create({
        data: {
          id: randomUUID(),
          score_detail_id: scoreDetailId,
          adjusted_by_id: adjustedById,
          old_score: oldScore,
          new_score: newScore,
          reason: reason || null,
        },
      });
    } catch (err) {
      console.warn('Lỗi khi ghi log điều chỉnh điểm:', err);
    }
  }

  // =============================================
  // HELPER: Ghi audit log (nhật ký hệ thống)
  // =============================================
  private async logAudit(
    actorId: string,
    action: string,
    entityType: string,
    entityId: string,
    oldValue?: any,
    newValue?: any,
  ) {
    try {
      await prisma.audit_logs.create({
        data: {
          id: randomUUID(),
          actor_id: actorId,
          action,
          entity_type: entityType,
          entity_id: entityId,
          old_value: oldValue != null ? oldValue : undefined,
          new_value: newValue != null ? newValue : undefined,
        },
      });
    } catch (err) {
      console.warn('Lỗi khi ghi audit log:', err);
    }
  }

  // =============================================
  // HELPER: Tìm hoặc tự động tạo phiếu DRAFT cho sinh viên
  // ✅ FIX: Gom logic trùng lặp từ 3 hàm về 1 nơi duy nhất
  //    + Xử lý Race Condition an toàn bằng try-catch P2002
  // =============================================
  private async getOrCreateDraftSheet(studentId: string, semesterId?: string) {
    // Bước 1: Tìm phiếu đã tồn tại
    const existing = await this.findSheetByStudent(studentId, semesterId);
    if (existing) return existing;

    // Bước 2: Xác định semester
    let targetSemesterId = semesterId;
    if (!targetSemesterId) {
      const activeSemester = await this.getActiveSemester();
      targetSemesterId = activeSemester?.id;
    }
    if (!targetSemesterId) {
      throw new BadRequestException('Không tìm thấy học kỳ đang hoạt động!');
    }

    // Bước 3: Xác định enrollment
    const enrollment = await this.resolveEnrollment(studentId, targetSemesterId);
    if (!enrollment) {
      throw new BadRequestException('Không tìm thấy thông tin đăng ký học kỳ của sinh viên!');
    }

    // Bước 4: Tạo phiếu DRAFT mới (với xử lý Race Condition)
    try {
      return await prisma.scoring_sheets.create({
        data: {
          id: randomUUID(),
          enrollment_id: enrollment.id,
          status: 'DRAFT',
          current_step: 1,
        },
      });
    } catch (createErr: any) {
      // Race condition: request song song đã tạo phiếu trước
      if (createErr?.code === 'P2002') {
        const retryFind = await this.findSheetByStudent(studentId, targetSemesterId);
        if (retryFind) return retryFind;
      }
      throw createErr;
    }
  }

  // =============================================
  // 0. LẤY DANH SÁCH SINH VIÊN CÙNG LỚP
  // =============================================
  async getStudentListByUser(userId: string) {
    // Tìm user đang đăng nhập
    const currentUser = await prisma.users.findFirst({
      where: { id: userId },
      select: { id: true, role: true },
    });

    if (!currentUser) {
      return { message: 'Không tìm thấy người dùng', data: [] };
    }

    // Xác định class_id qua semester_enrollments hoặc class_roles
    let classIds: string[] = [];
    const activeSemester = await this.getActiveSemester();

    if (activeSemester) {
      const enrollment = await prisma.semester_enrollments.findUnique({
        where: {
          user_id_semester_id: {
            user_id: currentUser.id,
            semester_id: activeSemester.id,
          },
        },
        select: { class_id: true },
      });
      if (enrollment) {
        classIds = [enrollment.class_id];
      }
    }

    // Fallback: class_roles (cho ADVISOR)
    if (classIds.length === 0) {
      const classRoles = await prisma.class_roles.findMany({
        where: { user_id: currentUser.id, is_active: 1 },
        select: { class_id: true },
      });
      classIds = classRoles.map((cr) => cr.class_id);
    }

    if (classIds.length === 0) {
      return { message: 'Không tìm thấy lớp phụ trách', data: [] };
    }

    // Lấy tất cả sinh viên cùng lớp qua semester_enrollments
    const enrollments = await prisma.semester_enrollments.findMany({
      where: {
        class_id: { in: classIds },
        ...(activeSemester ? { semester_id: activeSemester.id } : {}),
        is_active: 1,
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
            email: true,
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
      orderBy: { users: { full_name: 'asc' } },
    });

    // Map dữ liệu gọn cho frontend
    const data = enrollments.map((e) => {
      const s = e.users;
      const sheet = e.scoring_sheets || null;
      return {
        id: s.id,
        studentCode: s.student_id,
        name: s.full_name,
        email: s.email,
        formId: sheet?.id || null,
        status: sheet?.status || 'NO_SHEET',
        studentTotal: sheet?.student_total != null ? Number(sheet.student_total) : null,
        classTotal: sheet?.class_total != null ? Number(sheet.class_total) : null,
        advisorTotal: sheet?.advisor_total != null ? Number(sheet.advisor_total) : null,
        finalTotal: sheet?.final_total != null ? Number(sheet.final_total) : null,
        classification: sheet?.classification || null,
        studentSubmittedAt: sheet?.student_submitted_at || null,
        classReviewedAt: sheet?.class_reviewed_at || null,
        advisorApprovedAt: sheet?.advisor_approved_at || null,
      };
    });

    return {
      message: 'Lấy danh sách sinh viên thành công',
      data,
      classId: classIds.length === 1 ? classIds[0] : classIds.join(','),
    };
  }

  // =============================================
  // 1. LẤY TOÀN BỘ TIÊU CHÍ
  // =============================================
  async getAllCriteria() {
    const criteriaList = await prisma.criteria.findMany({
      where: { is_active: 1 },
      orderBy: { id: 'asc' },
    });

    return {
      message: 'Lấy danh mục tiêu chí thành công',
      data: criteriaList,
    };
  }

  // =============================================
  // 2. LẤY TOÀN BỘ ĐIỂM + TRẠNG THÁI PHIẾU
  //    ✅ MỚI: Trả thêm formStatus để Frontend biết khóa/mở
  // =============================================
  async getScoresByFormId(formId: string, studentId: string, semesterId?: string) {
    // ✅ FIX: Dùng helper chung thay vì copy-paste logic tạo phiếu
    const sheet = await this.getOrCreateDraftSheet(studentId, semesterId);
    const form = {
      id: sheet.id,
      status: sheet.status,
      current_step: sheet.current_step,
      rejection_reason: sheet.rejection_reason,
      student_total: sheet.student_total,
      class_total: sheet.class_total,
      advisor_total: sheet.advisor_total,
      final_total: sheet.final_total,
      student_submitted_at: sheet.student_submitted_at,
      class_reviewed_at: sheet.class_reviewed_at,
      advisor_approved_at: sheet.advisor_approved_at,
    };

    // Lấy chi tiết điểm (include score_entries mới)
    const scores = await prisma.score_details.findMany({
      where: { scoring_sheet_id: form.id },
      include: { criteria: true, score_entries: true },
      orderBy: { criteria_id: 'asc' },
    });

    // ✅ Map status chi tiết → status đơn giản cho Frontend
    const workflowStepMap: Record<string, string> = {
      DRAFT: 'DRAFT',
      STUDENT_SUBMITTED: 'SUBMITTED',
      CLASS_REVIEWING: 'SUBMITTED',
      CLASS_REVIEWED: 'CLASS_APPROVED',
      ADVISOR_REVIEWING: 'CLASS_APPROVED',
      ADVISOR_APPROVED: 'ADVISOR_APPROVED',
      SCHOOL_REVIEWING: 'ADVISOR_APPROVED',
      SCHOOL_APPROVED: 'ADVISOR_APPROVED',
      FINALIZED: 'ADVISOR_APPROVED',
    };

    const formStatus = workflowStepMap[form.status] || 'DRAFT';

    const enrollment = await prisma.semester_enrollments.findUnique({
      where: { id: sheet.enrollment_id }
    });
    const actualSemesterId = enrollment?.semester_id || semesterId;

    const studentUser = await prisma.users.findUnique({
      where: { id: studentId },
      include: {
        semester_enrollments: {
          where: { semester_id: actualSemesterId },
          include: {
            classes: {
              include: { departments: true }
            }
          }
        }
      }
    });

    const semesterData = actualSemesterId ? await prisma.semesters.findUnique({
      where: { id: actualSemesterId }
    }) : null;

    const studentInfo = {
      name: studentUser?.full_name || '',
      studentId: studentUser?.student_id || '',
      className: studentUser?.semester_enrollments?.[0]?.classes?.name || '',
      departmentName: studentUser?.semester_enrollments?.[0]?.classes?.departments?.name || '',
    };

    return {
      message: 'Lấy danh sách điểm thành công',
      data: scores,
      formId: form.id,
      formStatus,
      formStatusDetail: form.status,
      currentStep: form.current_step,
      rejectionReason: form.rejection_reason || null,
      studentInfo,
      semesterName: semesterData ? `Học kỳ ${semesterData.name} - Năm học ${semesterData.academic_year}` : '',
      totals: {
        student: form.student_total,
        class: form.class_total,
        advisor: form.advisor_total,
        final: form.final_total,
      },
      timestamps: {
        studentSubmittedAt: form.student_submitted_at,
        classReviewedAt: form.class_reviewed_at,
        advisorApprovedAt: form.advisor_approved_at,
      },
    };
  }

  // =============================================
  // 3. VALIDATE CHUNG
  //    ✅ MỚI: Kiểm tra quyền theo Role + Status
  // =============================================
  private async validateBeforeScore(
    formId: string,
    criteriaId: number,
    score: number,
    role: string,
    studentId: string,
    semesterId?: string,
  ) {
    // 3a. ✅ FIX: Dùng helper chung thay vì copy-paste logic tạo phiếu
    const form = await this.getOrCreateDraftSheet(studentId, semesterId);

    // 3b. ✅ KIỂM TRA QUYỀN CHẤM ĐIỂM THEO ROLE
    const allowedStatus = SCORING_PERMISSIONS[role];

    if (!allowedStatus) {
      throw new BadRequestException(
        `Vai trò "${role}" không hợp lệ. Chỉ chấp nhận: STUDENT, CLASS_COMMITTEE, ADVISOR`,
      );
    }

    if (form.status !== allowedStatus) {
      const roleLabels: Record<string, string> = {
        STUDENT: 'Sinh viên',
        CLASS_COMMITTEE: 'Lớp trưởng',
        ADVISOR: 'Cố vấn học tập',
      };

      const statusLabels: Record<string, string> = {
        DRAFT: 'Bản nháp',
        STUDENT_SUBMITTED: 'Đã nộp',
        CLASS_REVIEWED: 'BCS đã duyệt',
        ADVISOR_APPROVED: 'CVHT đã duyệt',
      };

      throw new BadRequestException(
        `${roleLabels[role]} chỉ được chấm khi phiếu ở trạng thái "${statusLabels[allowedStatus]}". ` +
        `Hiện tại phiếu đang ở: "${statusLabels[form.status] || form.status}"`,
      );
    }

    // 3b-2. ✅ KIỂM TRA HẠN CHÓT THEO ROLE
    const semester = await this.getSemesterWithDeadlines(semesterId);
    if (semester) {
      this.checkDeadline(role, semester);
    }

    // 3c. Kiểm tra tiêu chí
    const criteria = await prisma.criteria.findUnique({
      where: { id: criteriaId },
    });

    if (!criteria) {
      throw new BadRequestException('Không tìm thấy tiêu chí!');
    }

    if (!criteria.is_active) {
      throw new BadRequestException('Tiêu chí này đã bị vô hiệu hóa!');
    }

    const QUANTITY_MULTIPLIERS: Record<string, number> = {
      '1.2.1': 1, '3.2.1': 1,
      '1.2.2': 1, '3.2.2': 1, '4.2.1': 1,
      '1.2.3': 2, '3.2.3': 2, '4.2.2': 2, '5.3.1': 2,
      '1.2.4': 3, '3.2.4': 3, '5.2.2': 3,
      '1.2.5': 4,
      '5.3.4': 5,
      '1.1.3': -2, '1.2.7': -2, '2.3': -2, '3.1.2': -2, '3.3': -2, '4.3': -2
    };

    const isQuantityBased = criteria.code in QUANTITY_MULTIPLIERS;

    // 3d. Validate điểm: không được thấp hơn min / vượt quá max
    // max_points KHÔNG giới hạn ở leaf — chỉ giới hạn bởi trần điểm mục cha (frontend tính)
    if (isQuantityBased) {
      const multiplier = QUANTITY_MULTIPLIERS[criteria.code];
      const inputQuantity = score / multiplier;
      const isDeduction = criteria.score_type === 'DEDUCTION' || criteria.max_points < 0;
      const maxQuantity = isDeduction ? 40 : 30;
      
      if (inputQuantity < 0) {
        throw new BadRequestException(`Số lượng không được nhỏ hơn 0 (tiêu chí "${criteria.code}")`);
      }
      if (inputQuantity > maxQuantity) {
        throw new BadRequestException(`Số lượng không được vượt quá ${maxQuantity} lần (tiêu chí "${criteria.code}")`);
      }
    } else if (criteria.score_type === 'DEDUCTION' || criteria.max_points < 0) {
      // Đối với tiêu chí điểm trừ (deduction), max_points là số âm (ví dụ: -2), min_score là 0
      // Điểm hợp lệ phải nằm trong khoảng [max_points, min_score] (ví dụ: [-2, 0])
      if (score < criteria.max_points) {
        throw new BadRequestException(
          `Điểm không được thấp hơn ${criteria.max_points} (tiêu chí "${criteria.code}")`,
        );
      }
      if (score > (criteria.min_score ?? 0)) {
        throw new BadRequestException(
          `Điểm không được vượt quá ${criteria.min_score ?? 0} (tiêu chí "${criteria.code}")`,
        );
      }
    } else {
      // Đối với tiêu chí điểm cộng thông thường
      if (score < (criteria.min_score ?? 0)) {
        throw new BadRequestException(
          `Điểm không được thấp hơn ${criteria.min_score} (tiêu chí "${criteria.code}")`,
        );
      }
      // ✅ FIX: Kiểm tra score không được vượt quá max_points
      // Trước đây bỏ check ở đây dẫn đến lỗi Decimal(5,2) overflow → 500 khi nhập số quá lớn
      if (!isQuantityBased && criteria.max_points > 0 && score > criteria.max_points) {
        throw new BadRequestException(
          `Điểm không được vượt quá ${criteria.max_points} (tiêu chí "${criteria.code}")`,
        );
      }
    }

    return { form, criteria };
  }

  // =============================================
  // 4. SINH VIÊN TỰ CHẤM (Method chuyên dụng)
  // =============================================
  async saveStudentScore(
    formId: string,
    criteriaId: number,
    score: number,
    studentId: string,
    proofUrl?: string,
  ) {
    await this.validateBeforeScore(formId, criteriaId, score, 'STUDENT', studentId);

    // ✅ Lấy điểm cũ trước khi cập nhật (để ghi log)
    const existingStudentDetail = await prisma.score_details.findUnique({
      where: { scoring_sheet_id_criteria_id: { scoring_sheet_id: formId, criteria_id: criteriaId } },
      include: { score_entries: { where: { scorer_role: 'STUDENT' } } },
    });
    const oldStudentScore = existingStudentDetail?.score_entries?.[0]?.score != null
      ? Number(existingStudentDetail.score_entries[0].score)
      : null;

    const updateData: Record<string, any> = {};
    if (proofUrl !== undefined) {
      updateData.proof_url = proofUrl;
    }

    const detail = await prisma.score_details.upsert({
      where: {
        scoring_sheet_id_criteria_id: {
          scoring_sheet_id: formId,
          criteria_id: criteriaId,
        },
      },
      update: updateData,
      create: {
        id: randomUUID(),
        scoring_sheets: { connect: { id: formId } },
        criteria: { connect: { id: criteriaId } },
        ...updateData,
      },
    });

    // ✅ Dual-write: cũng ghi vào score_entries (bảng chuẩn hóa)
    await prisma.score_entries.upsert({
      where: {
        score_detail_id_scorer_role: {
          score_detail_id: detail.id,
          scorer_role: 'STUDENT',
        },
      },
      update: { score, scored_at: new Date() },
      create: {
        id: randomUUID(),
        score_detail_id: detail.id,
        scorer_role: 'STUDENT',
        score,
      },
    });

    // ✅ Ghi log điều chỉnh điểm (nếu điểm cũ khác điểm mới)
    if (oldStudentScore !== null && oldStudentScore !== score) {
      await this.logScoreAdjustment(detail.id, studentId, oldStudentScore, score, 'Sinh viên tự chấm điểm');
    }

    // ✅ Ghi audit log
    await this.logAudit(studentId, 'SCORE_CRITERIA', 'score_details', detail.id,
      { criteria_id: criteriaId, old_score: oldStudentScore },
      { criteria_id: criteriaId, new_score: score, role: 'STUDENT' },
    );

    return {
      message: 'Lưu điểm sinh viên thành công',
      data: detail,
    };
  }

  // =============================================
  // 5. CHẤM ĐIỂM THEO ROLE (Tổng quát cho cả 3 vai trò)
  //    ✅ MỚI: Validate quyền theo Role + Status
  // =============================================
  async submitCriteria(
    formId: string,
    criteriaId: number,
    score: number,
    role: string,
    studentId: string,
    actorId: string,
    proofUrl?: string,
    semesterId?: string,
  ) {
    // 5a. Validate (bao gồm kiểm tra quyền role)
    await this.validateBeforeScore(formId, criteriaId, score, role, studentId, semesterId);

    // 5b. Phân luồng theo Role
    const updateData: Record<string, any> = {};

    switch (role) {
      case 'STUDENT':
        if (proofUrl !== undefined) {
          updateData.proof_url = proofUrl;
        }
        break;

      case 'CLASS_COMMITTEE':
        break;

      case 'ADVISOR':
        break;

      default:
        throw new BadRequestException(
          `Vai trò "${role}" không hợp lệ`,
        );
    }

    // 5c. Tìm phiếu theo student_id (qua enrollment) để lấy scoring_sheet_id thực
    let targetSemesterId = semesterId;
    if (!targetSemesterId) {
      const activeSemester = await this.getActiveSemester();
      targetSemesterId = activeSemester?.id;
    }
    const scoreRecord = await prisma.scoring_sheets.findFirst({
      where: {
        semester_enrollments: {
          user_id: studentId,
          ...(targetSemesterId ? { semester_id: targetSemesterId } : {}),
        },
      },
      select: { id: true },
    });

    if (!scoreRecord) {
      throw new BadRequestException('Không tìm thấy phiếu điểm cho sinh viên này!');
    }

    // 5d. Lấy điểm cũ trước khi cập nhật (để ghi log)
    const existingScoreDetail = await prisma.score_details.findUnique({
      where: { scoring_sheet_id_criteria_id: { scoring_sheet_id: scoreRecord.id, criteria_id: criteriaId } },
      include: { score_entries: { where: { scorer_role: role as any } } },
    });
    const oldScore = existingScoreDetail?.score_entries?.[0]?.score != null
      ? Number(existingScoreDetail.score_entries[0].score)
      : null;

    // 5e. Upsert
    const savedScore = await prisma.score_details.upsert({
      where: {
        scoring_sheet_id_criteria_id: {
          scoring_sheet_id: scoreRecord.id,
          criteria_id: criteriaId,
        },
      },
      update: {
        ...updateData,
        updated_at: new Date(),
      },
      create: {
        id: randomUUID(),
        scoring_sheets: { connect: { id: scoreRecord.id } },
        criteria: { connect: { id: criteriaId } },
        ...updateData,
      },
    });

    // ✅ Dual-write: cũng ghi vào score_entries (bảng chuẩn hóa)
    const scorerRole = role as 'STUDENT' | 'CLASS_COMMITTEE' | 'ADVISOR';
    await prisma.score_entries.upsert({
      where: {
        score_detail_id_scorer_role: {
          score_detail_id: savedScore.id,
          scorer_role: scorerRole,
        },
      },
      update: { score, scored_at: new Date() },
      create: {
        id: randomUUID(),
        score_detail_id: savedScore.id,
        scorer_role: scorerRole,
        score,
      },
    });

    // ✅ Ghi log điều chỉnh điểm (nếu điểm cũ khác điểm mới)
    if (oldScore !== null && oldScore !== score) {
      await this.logScoreAdjustment(savedScore.id, actorId, oldScore, score, `Chấm điểm bởi ${role}`);
    }

    // ✅ Ghi audit log
    await this.logAudit(actorId, 'SCORE_CRITERIA', 'score_details', savedScore.id,
      { criteria_id: criteriaId, old_score: oldScore },
      { criteria_id: criteriaId, new_score: score, role },
    );

    return {
      message: `Lưu điểm thành công (${role})`,
      data: savedScore,
    };
  }

  // =============================================
  // 6. ✅ CHUYỂN TRẠNG THÁI PHIẾU (State Machine)
  //    Gộp từ cả 2 phiên bản: NestJS exceptions + Role-based transitions
  //    Frontend gửi: POST /scoring/:formId/submit  { role: 'STUDENT' }
  // =============================================
  async submitForm(formId: string, role: string, studentId: string, actorId: string, semesterId?: string) {
    // 6a. ✅ FIX: Dùng helper chung thay vì copy-paste logic tạo phiếu
    const form = await this.getOrCreateDraftSheet(studentId, semesterId);

    // 6a-2. ✅ KIỂM TRA HẠN CHÓT TRƯỚC KHI CHUYỂN TRẠNG THÁI
    const semester = await this.getSemesterWithDeadlines(semesterId);
    if (semester) {
      this.checkDeadline(role, semester);
    }

    // 6b. Lấy cấu hình chuyển trạng thái cho Role này
    const transition = STATE_TRANSITIONS[role];

    if (!transition) {
      throw new BadRequestException(
        `Vai trò "${role}" không hợp lệ. Chỉ chấp nhận: STUDENT, CLASS_COMMITTEE, ADVISOR`,
      );
    }

    // 6c. ✅ KIỂM TRA STATE MACHINE NGHIÊM NGẶT
    if (form.status !== transition.requiredStatus) {
      throw new BadRequestException(transition.errorMessage);
    }

    // 6d. (Đã gỡ bỏ ràng buộc "phải chấm ít nhất 1 điểm")
    // Cho phép nộp phiếu trống → tổng điểm = 0

    // 6e. ✅ TÍNH TỔNG ĐIỂM TRƯỚC KHI CHUYỂN TRẠNG THÁI
    const totals = await this.calculateTotals(form.id);

    // 6f. ✅ CẬP NHẬT DATABASE (Status + Timestamp + Tổng điểm + current_step)
    const updateData: Record<string, any> = {
      status: transition.nextStatus,
      current_step: transition.currentStep,
      updated_at: new Date(),
      [transition.timestampField]: new Date(),
      // Clear rejection info when resubmitting
      rejection_reason: null,
      rejected_by_step: null,
    };

    // Gắn tổng điểm tương ứng
    if (role === 'STUDENT') {
      updateData.student_total = totals.studentTotal;
    } else if (role === 'CLASS_COMMITTEE') {
      updateData.class_total = totals.classTotal;
    } else if (role === 'ADVISOR') {
      updateData.advisor_total = totals.advisorTotal;
      updateData.final_total = totals.advisorTotal; // Điểm cuối = điểm CVHT
      updateData.classification = this.getClassification(
        Number(totals.advisorTotal),
      );
    }

    const updated = await prisma.scoring_sheets.update({
      where: { id: form.id },
      data: updateData,
    });

    // ✅ Ghi audit log cho việc chuyển trạng thái phiếu
    await this.logAudit(actorId, 'SUBMIT_FORM', 'scoring_sheets', form.id,
      { status: form.status, current_step: form.current_step },
      { status: transition.nextStatus, current_step: transition.currentStep, role },
    );

    // BẮN THÔNG BÁO CHO NGƯỜI NHẬN TIẾP THEO (LỚP TRƯỞNG / CỐ VẤN)
    try {
      if (role === 'STUDENT') {
        // Lấy thông tin sinh viên + class_id qua enrollment
        const sheetWithEnrollment = await prisma.scoring_sheets.findUnique({
          where: { id: form.id },
          select: {
            semester_enrollments: {
              select: {
                class_id: true,
                users: { select: { full_name: true } },
              },
            },
          },
        });
        const enrollInfo = sheetWithEnrollment?.semester_enrollments;
        if (enrollInfo) {
          // ✅ FIX: Chỉ dùng class_roles (Single Source of Truth), loại bỏ fallback lỏng lẻo
          const classMonitorRoles = await prisma.class_roles.findMany({
            where: { class_id: enrollInfo.class_id, is_active: 1, role_type: 'MONITOR' },
            select: { user_id: true },
          });
          const monitorIds = classMonitorRoles.map(cr => cr.user_id);
          if (monitorIds.length > 0) {
            await prisma.notifications.createMany({
              data: monitorIds.map(uid => ({
                id: randomUUID(),
                user_id: uid,
                type: 'SCORE_SUBMITTED' as const,
                title: 'Có phiếu rèn luyện mới gửi lên',
                content: `Sinh viên ${enrollInfo.users.full_name} đã nộp tự đánh giá điểm rèn luyện. Vui lòng chấm duyệt.`,
                is_read: 0,
              })),
            });
          }
        }
      } else if (role === 'CLASS_COMMITTEE') {
        // Lấy thông tin sinh viên + class_id qua enrollment
        const sheetWithEnrollment = await prisma.scoring_sheets.findUnique({
          where: { id: form.id },
          select: {
            semester_enrollments: {
              select: {
                class_id: true,
                user_id: true,
                users: { select: { full_name: true } },
              },
            },
          },
        });
        const enrollInfo = sheetWithEnrollment?.semester_enrollments;
        if (enrollInfo) {
          // 1. Thông báo cho sinh viên: BCS đã duyệt
          await prisma.notifications.create({
            data: {
              id: randomUUID(),
              user_id: enrollInfo.user_id,
              type: 'SCORE_REVIEWED',
              title: 'Phiếu rèn luyện đã được Ban cán sự duyệt',
              content: 'Phiếu tự đánh giá của bạn đã được Ban cán sự lớp duyệt và chuyển cho Cố vấn học tập.',
              is_read: 0,
            },
          });

          // 2. Thông báo cho Cố vấn học tập
          const advisorRoles = await prisma.class_roles.findMany({
            where: { class_id: enrollInfo.class_id, is_active: 1, role_type: 'ADVISOR' },
            select: { user_id: true },
          });
          const advisorIds = advisorRoles.map(cr => cr.user_id);
          if (advisorIds.length > 0) {
            await prisma.notifications.createMany({
              data: advisorIds.map(uid => ({
                id: randomUUID(),
                user_id: uid,
                type: 'SCORE_REVIEWED' as const,
                title: 'Có phiếu rèn luyện chờ phê duyệt',
                content: `Phiếu của sinh viên ${enrollInfo.users.full_name} đã được BCS duyệt. Vui lòng phê duyệt.`,
                is_read: 0,
              })),
            });
          }
        }
      } else if (role === 'ADVISOR') {
        // Thông báo cho sinh viên: CVHT đã phê duyệt
        await prisma.notifications.create({
          data: {
            id: randomUUID(),
            user_id: studentId,
            type: 'SCORE_APPROVED',
            title: 'Phiếu rèn luyện đã được phê duyệt',
            content: 'Phiếu tự đánh giá của bạn đã được Cố vấn học tập phê duyệt và chốt sổ.',
            is_read: 0,
          },
        });
      }
    } catch (err) {
      console.warn('Lỗi khi gửi thông báo nội bộ:', err);
    }

    return {
      message: this.getSuccessMessage(role),
      data: updated,
    };
  }

  // =============================================
  // 6.1 ✅ XÓA VÀ LÀM MỚI PHIẾU (Thay cho chức năng Trả lại)
  // =============================================
  async rejectForm(formId: string, role: string, studentId: string, actorId: string, semesterId?: string) {
    let targetSemesterId = semesterId;
    if (!targetSemesterId) {
      const activeSemester = await this.getActiveSemester();
      targetSemesterId = activeSemester?.id;
    }

    const form = await prisma.scoring_sheets.findFirst({
      where: {
        semester_enrollments: {
          user_id: studentId,
          ...(targetSemesterId ? { semester_id: targetSemesterId } : {}),
        },
      },
      include: { score_details: true },
    });

    if (!form) {
      throw new BadRequestException('Không tìm thấy phiếu điểm của sinh viên này!');
    }

    if (role !== 'CLASS_COMMITTEE' && role !== 'ADVISOR') {
      throw new BadRequestException('Chỉ Ban cán sự và Cố vấn học tập mới có quyền xóa/reset phiếu!');
    }

    // Xóa toàn bộ dữ liệu liên quan để "làm mới hoàn toàn"
    await prisma.$transaction([
      // 1. Xóa chi tiết điểm
      prisma.score_details.deleteMany({
        where: { scoring_sheet_id: form.id }
      }),
      // 2. Xóa chính phiếu điểm
      prisma.scoring_sheets.delete({
        where: { id: form.id }
      })
    ]);

    // ✅ Ghi audit log cho việc xóa/reset phiếu
    await this.logAudit(actorId, 'REJECT_FORM', 'scoring_sheets', form.id,
      { status: form.status, score_details_count: form.score_details?.length ?? 0 },
      { action: 'DELETED_AND_RESET', role },
    );

    // Thông báo cho sinh viên: phiếu bị trả lại
    try {
      const rejecterLabel = role === 'CLASS_COMMITTEE' ? 'Ban cán sự lớp' : 'Cố vấn học tập';
      await prisma.notifications.create({
        data: {
          id: randomUUID(),
          user_id: studentId,
          type: 'SCORE_REJECTED',
          title: 'Phiếu rèn luyện đã bị trả lại',
          content: `Phiếu tự đánh giá của bạn đã bị ${rejecterLabel} trả lại. Vui lòng chấm lại từ đầu.`,
          is_read: 0,
        },
      });
    } catch (notifErr) {
      console.warn('Lỗi khi gửi thông báo trả lại:', notifErr);
    }

    return {
      message: 'Đã xóa phiếu điểm thành công! Sinh viên có thể bắt đầu lại từ đầu.',
      data: null,
    };
  }

  // =============================================
  // 7. ✅ TÍNH TỔNG ĐIỂM TỰ ĐỘNG
  //    ✅ FIX: Áp trần điểm theo danh mục (category max_score)
  //    Tránh tổng điểm vượt quá giới hạn khi gọi API trực tiếp
  // =============================================
  private async calculateTotals(formId: string) {
    // Lấy score_details + score_entries + criteria (để biết category_id)
    const details = await prisma.score_details.findMany({
      where: { scoring_sheet_id: formId },
      select: {
        criteria: {
          select: { category_id: true },
        },
        score_entries: {
          select: { scorer_role: true, score: true },
        },
      },
    });

    // Lấy danh sách tất cả danh mục (để biết max_score mỗi danh mục)
    const categories = await prisma.criteria_categories.findMany({
      select: { id: true, max_score: true },
    });
    const categoryMaxMap = new Map<string, number>();
    for (const cat of categories) {
      categoryMaxMap.set(cat.id, cat.max_score);
    }

    // Gom điểm theo từng danh mục (category_id)
    const byCategoryStudent = new Map<string, number>();
    const byCategoryClass = new Map<string, number>();
    const byCategoryAdvisor = new Map<string, number>();

    for (const d of details) {
      const catId = d.criteria?.category_id;
      if (!catId) continue;

      const entries = d.score_entries || [];
      const sEntry = entries.find((e: any) => e.scorer_role === 'STUDENT');
      const cEntry = entries.find((e: any) => e.scorer_role === 'CLASS_COMMITTEE');
      const aEntry = entries.find((e: any) => e.scorer_role === 'ADVISOR');

      byCategoryStudent.set(catId, (byCategoryStudent.get(catId) || 0) + Number(sEntry?.score ?? 0));
      byCategoryClass.set(catId, (byCategoryClass.get(catId) || 0) + Number(cEntry?.score ?? 0));
      byCategoryAdvisor.set(catId, (byCategoryAdvisor.get(catId) || 0) + Number(aEntry?.score ?? 0));
    }

    // Tính tổng sau khi áp trần cho mỗi danh mục
    let studentTotal = 0;
    let classTotal = 0;
    let advisorTotal = 0;

    for (const [catId, maxScore] of categoryMaxMap) {
      const rawStudent = byCategoryStudent.get(catId) || 0;
      const rawClass = byCategoryClass.get(catId) || 0;
      const rawAdvisor = byCategoryAdvisor.get(catId) || 0;

      // ✅ FIX: Chỉ áp trần (max_score), KHÔNG áp sàn 0 để điểm trừ có thể trừ vào tổng điểm các mục khác
      // Math.min: không vượt quá max_score của danh mục
      studentTotal += Math.min(rawStudent, maxScore);
      classTotal += Math.min(rawClass, maxScore);
      advisorTotal += Math.min(rawAdvisor, maxScore);
    }

    // Đảm bảo tổng điểm cuối cùng không bị âm (đến khi tổng điểm phiếu về không thì dừng)
    studentTotal = Math.max(0, studentTotal);
    classTotal = Math.max(0, classTotal);
    advisorTotal = Math.max(0, advisorTotal);

    // ✅ FIX: Làm tròn về 1 chữ số thập phân — khớp kiểu Decimal(5,1) trong DB
    //    Tránh sai lệch xếp loại do JS float precision (79.999... vs 80.0)
    studentTotal = Math.round(studentTotal * 10) / 10;
    classTotal = Math.round(classTotal * 10) / 10;
    advisorTotal = Math.round(advisorTotal * 10) / 10;

    return { studentTotal, classTotal, advisorTotal };
  }

  // =============================================
  // 8. ✅ XẾP LOẠI TỰ ĐỘNG
  // =============================================
  private getClassification(
    totalScore: number,
  ): string {
    if (totalScore >= 90) return 'EXCELLENT';
    if (totalScore >= 80) return 'VERY_GOOD';
    if (totalScore >= 65) return 'GOOD';
    if (totalScore >= 50) return 'AVERAGE';
    if (totalScore >= 35) return 'WEAK';
    return 'POOR';
  }

  // =============================================
  // 9. ✅ TIN NHẮN THÀNH CÔNG THEO ROLE
  // =============================================
  private getSuccessMessage(role: string): string {
    switch (role) {
      case 'STUDENT':
        return 'Nộp phiếu thành công! Phiếu đã được chuyển cho Lớp trưởng xét duyệt.';
      case 'CLASS_COMMITTEE':
        return 'Duyệt thành công! Phiếu đã được chuyển cho Cố vấn học tập.';
      case 'ADVISOR':
        return 'Phê duyệt hoàn tất! Phiếu đã được chốt sổ cuối cùng.';
      default:
        return 'Chuyển trạng thái thành công!';
    }
  }
}