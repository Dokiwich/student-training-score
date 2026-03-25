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
  CLASS_PRESIDENT: {
    requiredStatus: WorkflowStatus.SUBMITTED,
    nextStatus: WorkflowStatus.CLASS_APPROVED,
    timestampField: 'class_reviewed_at',
    currentStep: 3,
    errorMessage: 'Lớp trưởng chỉ được duyệt khi Sinh viên đã nộp (SUBMITTED)',
  },
  ADVISOR: {
    requiredStatus: WorkflowStatus.ADVISOR_APPROVED,
    nextStatus: WorkflowStatus.ADVISOR_APPROVED,
    timestampField: 'advisor_approved_at',
    currentStep: 4,
    errorMessage: 'Cố vấn chỉ được chốt khi Lớp trưởng đã duyệt (CLASS_APPROVED)',
  },
};

// ✅ MA TRẬN QUYỀN CHẤM ĐIỂM
// Role nào được chấm ở trạng thái nào?
const SCORING_PERMISSIONS: Record<string, string> = {
  STUDENT: WorkflowStatus.DRAFT,
  CLASS_PRESIDENT: WorkflowStatus.SUBMITTED,
  ADVISOR: WorkflowStatus.CLASS_APPROVED,
};

// Fix: ADVISOR transition cần đúng requiredStatus
STATE_TRANSITIONS.ADVISOR.requiredStatus = WorkflowStatus.CLASS_APPROVED;

@Injectable()
export class ScoringService {

  // =============================================
  // 1. LẤY TOÀN BỘ TIÊU CHÍ
  // =============================================
  async getAllCriteria() {
    const criteriaList = await prisma.criteria.findMany({
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
  async getScoresByFormId(formId: string) {
    // Lấy thông tin phiếu (bao gồm trạng thái)
    const form = await prisma.scoring_sheets.findUnique({
      where: { id: formId },
      select: {
        id: true,
        status: true,
        current_step: true,
        student_total: true,
        class_total: true,
        advisor_total: true,
        final_total: true,
        student_submitted_at: true,
        class_reviewed_at: true,
        advisor_approved_at: true,
      },
    });

    if (!form) {
      throw new BadRequestException('Không tìm thấy phiếu điểm!');
    }

    // Lấy chi tiết điểm
    const scores = await prisma.score_details.findMany({
      where: { scoring_sheet_id: formId },
      include: { criteria: true },
      orderBy: { criteria_id: 'asc' },
    });

    // ✅ Map status chi tiết → status đơn giản cho Frontend
    const workflowStepMap: Record<string, string> = {
      DRAFT: 'DRAFT',
      STUDENT_SUBMITTED: 'SUBMITTED',
      CLASS_REVIEWING: 'SUBMITTED',
      CLASS_REVIEWED: 'CLASS_APPROVED',
      CLASS_REJECTED: 'DRAFT',           // Bị trả về → SV sửa lại
      ADVISOR_REVIEWING: 'CLASS_APPROVED',
      ADVISOR_APPROVED: 'ADVISOR_APPROVED',
      ADVISOR_REJECTED: 'SUBMITTED',     // Bị trả về → BCS xét lại
      SCHOOL_REVIEWING: 'ADVISOR_APPROVED',
      SCHOOL_APPROVED: 'ADVISOR_APPROVED',
      FINALIZED: 'ADVISOR_APPROVED',
    };

    const formStatus = workflowStepMap[form.status] || 'DRAFT';

    return {
      message: 'Lấy danh sách điểm thành công',
      data: scores,
      // ✅ THÊM THÔNG TIN PHIẾU CHO FRONTEND
      formStatus,                    // Status đơn giản (4 bước)
      formStatusDetail: form.status, // Status chi tiết (12 bước)
      currentStep: form.current_step,
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
  ) {
    // 3a. Kiểm tra phiếu điểm
    const form = await prisma.scoring_sheets.findUnique({
      where: { id: formId },
    });

    if (!form) {
      throw new BadRequestException('Không tìm thấy phiếu điểm!');
    }

    // 3b. ✅ KIỂM TRA QUYỀN CHẤM ĐIỂM THEO ROLE
    const allowedStatus = SCORING_PERMISSIONS[role];

    if (!allowedStatus) {
      throw new BadRequestException(
        `Vai trò "${role}" không hợp lệ. Chỉ chấp nhận: STUDENT, CLASS_PRESIDENT, ADVISOR`,
      );
    }

    if (form.status !== allowedStatus) {
      const roleLabels: Record<string, string> = {
        STUDENT: 'Sinh viên',
        CLASS_PRESIDENT: 'Lớp trưởng',
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

    // 3d. Validate điểm
    if (score < (criteria.min_score ?? 0)) {
      throw new BadRequestException(
        `Điểm không được thấp hơn ${criteria.min_score} (tiêu chí "${criteria.code}")`,
      );
    }

    if (score > criteria.max_points) {
      throw new BadRequestException(
        `Điểm không được vượt quá ${criteria.max_points} (tiêu chí "${criteria.code}")`,
      );
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
    proofUrl?: string,
  ) {
    await this.validateBeforeScore(formId, criteriaId, score, 'STUDENT');

    const updateData: Record<string, any> = { student_score: score };
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
    proofUrl?: string,
  ) {
    // 5a. Validate (bao gồm kiểm tra quyền role)
    await this.validateBeforeScore(formId, criteriaId, score, role);

    // 5b. Phân luồng theo Role
    const updateData: Record<string, any> = {};

    switch (role) {
      case 'STUDENT':
        updateData.student_score = score;
        if (proofUrl !== undefined) {
          updateData.proof_url = proofUrl;
        }
        break;

      case 'CLASS_PRESIDENT':
        updateData.class_score = score;
        break;

      case 'ADVISOR':
        updateData.advisor_score = score;
        break;

      default:
        throw new BadRequestException(
          `Vai trò "${role}" không hợp lệ`,
        );
    }

    // 5c. Upsert
    const savedScore = await prisma.score_details.upsert({
      where: {
        scoring_sheet_id_criteria_id: {
          scoring_sheet_id: formId,
          criteria_id: criteriaId,
        },
      },
      update: {
        ...updateData,
        updated_at: new Date(),
      },
      create: {
        id: randomUUID(),
        scoring_sheets: { connect: { id: formId } },
        criteria: { connect: { id: criteriaId } },
        ...updateData,
      },
    });

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
  async submitForm(formId: string, role: string) {
    // 6a. Tìm phiếu trong Database
    const form = await prisma.scoring_sheets.findUnique({
      where: { id: formId },
    });

    if (!form) {
      throw new BadRequestException(
        'Không tìm thấy phiếu điểm! Vui lòng nhập ít nhất 1 điểm trước khi nộp.',
      );
    }

    // 6b. Lấy cấu hình chuyển trạng thái cho Role này
    const transition = STATE_TRANSITIONS[role];

    if (!transition) {
      throw new BadRequestException(
        `Vai trò "${role}" không hợp lệ. Chỉ chấp nhận: STUDENT, CLASS_PRESIDENT, ADVISOR`,
      );
    }

    // 6c. ✅ KIỂM TRA STATE MACHINE NGHIÊM NGẶT
    if (form.status !== transition.requiredStatus) {
      throw new BadRequestException(transition.errorMessage);
    }

    // 6d. ✅ VALIDATE BỔ SUNG TRƯỚC KHI CHUYỂN
    if (role === 'STUDENT') {
      // Kiểm tra SV đã chấm ít nhất 1 tiêu chí chưa
      const detailCount = await prisma.score_details.count({
        where: {
          scoring_sheet_id: formId,
          student_score: { not: null },
        },
      });

      if (detailCount === 0) {
        throw new BadRequestException(
          'Bạn chưa chấm điểm tiêu chí nào! Vui lòng nhập ít nhất 1 điểm trước khi nộp.',
        );
      }
    }

    if (role === 'CLASS_PRESIDENT') {
      // Kiểm tra BCS đã chấm ít nhất 1 tiêu chí chưa
      const classDetailCount = await prisma.score_details.count({
        where: {
          scoring_sheet_id: formId,
          class_score: { not: null },
        },
      });

      if (classDetailCount === 0) {
        throw new BadRequestException(
          'Lớp trưởng chưa chấm điểm tiêu chí nào! Vui lòng chấm trước khi duyệt.',
        );
      }
    }

    if (role === 'ADVISOR') {
      // Kiểm tra CVHT đã chấm ít nhất 1 tiêu chí chưa
      const advisorDetailCount = await prisma.score_details.count({
        where: {
          scoring_sheet_id: formId,
          advisor_score: { not: null },
        },
      });

      if (advisorDetailCount === 0) {
        throw new BadRequestException(
          'Cố vấn học tập chưa chấm điểm tiêu chí nào! Vui lòng chấm trước khi phê duyệt.',
        );
      }
    }

    // 6e. ✅ TÍNH TỔNG ĐIỂM TRƯỚC KHI CHUYỂN TRẠNG THÁI
    const totals = await this.calculateTotals(formId);

    // 6f. ✅ CẬP NHẬT DATABASE (Status + Timestamp + Tổng điểm + current_step)
    const updateData: Record<string, any> = {
      status: transition.nextStatus,
      current_step: transition.currentStep,
      updated_at: new Date(),
      [transition.timestampField]: new Date(),
    };

    // Gắn tổng điểm tương ứng
    if (role === 'STUDENT') {
      updateData.student_total = totals.studentTotal;
    } else if (role === 'CLASS_PRESIDENT') {
      updateData.class_total = totals.classTotal;
    } else if (role === 'ADVISOR') {
      updateData.advisor_total = totals.advisorTotal;
      updateData.final_total = totals.advisorTotal; // Điểm cuối = điểm CVHT
      updateData.classification = this.getClassification(
        Number(totals.advisorTotal),
      );
    }

    const updated = await prisma.scoring_sheets.update({
      where: { id: formId },
      data: updateData,
    });

    return {
      message: this.getSuccessMessage(role),
      data: updated,
    };
  }

  // =============================================
  // 7. ✅ TÍNH TỔNG ĐIỂM TỰ ĐỘNG
  // =============================================
  private async calculateTotals(formId: string) {
    const details = await prisma.score_details.findMany({
      where: { scoring_sheet_id: formId },
      select: {
        student_score: true,
        class_score: true,
        advisor_score: true,
      },
    });

    const studentTotal = details.reduce(
      (sum, d) => sum + Number(d.student_score || 0),
      0,
    );
    const classTotal = details.reduce(
      (sum, d) => sum + Number(d.class_score || 0),
      0,
    );
    const advisorTotal = details.reduce(
      (sum, d) => sum + Number(d.advisor_score || 0),
      0,
    );

    return {
      studentTotal: Math.min(studentTotal, 100),
      classTotal: Math.min(classTotal, 100),
      advisorTotal: Math.min(advisorTotal, 100),
    };
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
      case 'CLASS_PRESIDENT':
        return 'Duyệt thành công! Phiếu đã được chuyển cho Cố vấn học tập.';
      case 'ADVISOR':
        return 'Phê duyệt hoàn tất! Phiếu đã được chốt sổ cuối cùng.';
      default:
        return 'Chuyển trạng thái thành công!';
    }
  }
}