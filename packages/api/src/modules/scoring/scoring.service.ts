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
  // HELPER: Lấy class_id từ semester_enrollments (fallback users.class_id)
  // =============================================
  private async resolveClassId(userId: string, semesterId: string): Promise<string | null> {
    // 1. Tìm trong semester_enrollments trước
    const enrollment = await prisma.semester_enrollments.findUnique({
      where: {
        user_id_semester_id: {
          user_id: userId,
          semester_id: semesterId,
        },
      },
      select: { class_id: true },
    });
    if (enrollment) return enrollment.class_id;

    // 2. Fallback: users.class_id (backward compatible)
    const user = await prisma.users.findFirst({
      where: { id: userId },
      select: { class_id: true },
    });
    return user?.class_id || null;
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
  // 0. LẤY DANH SÁCH SINH VIÊN CÙNG LỚP
  // =============================================
  async getStudentListByUser(userId: string) {
    // Tìm user đang đăng nhập
    const currentUser = await prisma.users.findFirst({
      where: { id: userId },
      select: { id: true, class_id: true, role: true },
    });

    if (!currentUser) {
      return { message: 'Không tìm thấy người dùng', data: [] };
    }

    // Xác định class_id qua semester_enrollments (fallback users.class_id)
    let classIds: string[] = [];
    const activeSemester = await this.getActiveSemester();

    if (activeSemester) {
      // Thử enrollment trước
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

    // Fallback: users.class_id hoặc class_roles
    if (classIds.length === 0) {
      if (currentUser.class_id) {
        classIds = [currentUser.class_id];
      } else {
        // Tìm trong class_roles (cho ADVISOR)
        const classRoles = await prisma.class_roles.findMany({
          where: { user_id: currentUser.id, is_active: 1 },
          select: { class_id: true },
        });
        classIds = classRoles.map((cr) => cr.class_id);
      }
    }

    if (classIds.length === 0) {
      return { message: 'Không tìm thấy lớp phụ trách', data: [] };
    }

    // Lấy tất cả sinh viên cùng lớp (hỗ trợ nhiều lớp cho ADVISOR)
    const students = await prisma.users.findMany({
      where: {
        class_id: { in: classIds },
        role: { in: ['STUDENT', 'CLASS_COMMITTEE'] },
        is_active: 1,
      },
      select: {
        id: true,
        student_id: true,
        full_name: true,
        email: true,
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
          take: 1,
          orderBy: { created_at: 'desc' },
        },
      },
      orderBy: { full_name: 'asc' },
    });

    // Map dữ liệu gọn cho frontend
    const data = students.map((s) => {
      const sheet = s.scoring_sheets[0] || null;
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
  async getScoresByFormId(formId: string, studentId: string) {
    // Tìm phiếu theo student_id (không dùng formId cố định nữa)
    let form = await prisma.scoring_sheets.findFirst({
      where: { student_id: studentId },
      select: {
        id: true,
        status: true,
        current_step: true,
        rejection_reason: true,
        student_total: true,
        class_total: true,
        advisor_total: true,
        final_total: true,
        student_submitted_at: true,
        class_reviewed_at: true,
        advisor_approved_at: true,
      },
    });

    // Auto-provision: Tạo phiếu DRAFT nếu chưa có
    if (!form) {
      const activeSemester = await this.getActiveSemester();
      if (!activeSemester) {
        throw new BadRequestException('Không tìm thấy học kỳ đang hoạt động!');
      }

      const classId = await this.resolveClassId(studentId, activeSemester.id);
      if (!classId) {
        throw new BadRequestException('Không tìm thấy thông tin sinh viên hoặc lớp!');
      }

      const newSheet = await prisma.scoring_sheets.create({
        data: {
          id: randomUUID(),
          student_id: studentId,
          semester_id: activeSemester.id,
          class_id: classId,
          status: 'DRAFT',
          current_step: 1,
        },
      });

      form = {
        id: newSheet.id,
        status: newSheet.status,
        current_step: newSheet.current_step,
        rejection_reason: null,
        student_total: newSheet.student_total,
        class_total: newSheet.class_total,
        advisor_total: newSheet.advisor_total,
        final_total: newSheet.final_total,
        student_submitted_at: newSheet.student_submitted_at,
        class_reviewed_at: newSheet.class_reviewed_at,
        advisor_approved_at: newSheet.advisor_approved_at,
      };
    }

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

    return {
      message: 'Lấy danh sách điểm thành công',
      data: scores,
      formId: form.id,
      formStatus,
      formStatusDetail: form.status,
      currentStep: form.current_step,
      rejectionReason: form.rejection_reason || null,
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
  ) {
    // 3a. Tìm hoặc tự tạo phiếu điểm theo student_id
    let form = await prisma.scoring_sheets.findFirst({
      where: { student_id: studentId },
    });

    if (!form) {
      const activeSemester = await this.getActiveSemester();
      if (!activeSemester) {
        throw new BadRequestException('Không tìm thấy học kỳ đang hoạt động!');
      }

      const classId = await this.resolveClassId(studentId, activeSemester.id);
      if (!classId) {
        throw new BadRequestException('Không tìm thấy thông tin sinh viên hoặc lớp!');
      }

      // Use upsert-like pattern: try to find again (in case another parallel request just created it)
      form = await prisma.scoring_sheets.findFirst({
        where: { student_id: studentId },
      });

      if (!form) {
        try {
          form = await prisma.scoring_sheets.create({
            data: {
              id: randomUUID(),
              student_id: studentId,
              semester_id: activeSemester.id,
              class_id: classId,
              status: 'DRAFT',
              current_step: 1,
            },
          });
        } catch (createErr: any) {
          // Handle race condition: another request may have created the sheet
          if (createErr?.code === 'P2002') {
            form = await prisma.scoring_sheets.findFirst({
              where: { student_id: studentId },
            });
            if (!form) {
              throw new BadRequestException('Không thể tạo phiếu điểm!');
            }
          } else {
            throw createErr;
          }
        }
      }
    }

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

    // 3d. Validate điểm: không được thấp hơn min
    // max_points KHÔNG giới hạn ở leaf — chỉ giới hạn bởi trần điểm mục cha (frontend tính)
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
    studentId: string,
    proofUrl?: string,
  ) {
    await this.validateBeforeScore(formId, criteriaId, score, 'STUDENT', studentId);

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
    proofUrl?: string,
  ) {
    // 5a. Validate (bao gồm kiểm tra quyền role)
    await this.validateBeforeScore(formId, criteriaId, score, role, studentId);

    // 5b. Phân luồng theo Role
    const updateData: Record<string, any> = {};

    switch (role) {
      case 'STUDENT':
        updateData.student_score = score;
        if (proofUrl !== undefined) {
          updateData.proof_url = proofUrl;
        }
        break;

      case 'CLASS_COMMITTEE':
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

    // 5c. Tìm phiếu theo student_id để lấy scoring_sheet_id thực
    const scoreRecord = await prisma.scoring_sheets.findFirst({
      where: { student_id: studentId },
      select: { id: true },
    });

    if (!scoreRecord) {
      throw new BadRequestException('Không tìm thấy phiếu điểm cho sinh viên này!');
    }

    // 5d. Upsert
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
  async submitForm(formId: string, role: string, studentId: string) {
    // 6a. Tìm phiếu theo student_id
    let form = await prisma.scoring_sheets.findFirst({
      where: { student_id: studentId },
    });

    // Fix: Nếu chưa có phiếu, tự tạo DRAFT thay vì ném lỗi
    if (!form) {
      const student = await prisma.users.findFirst({
        where: { id: studentId },
        select: { class_id: true },
      });

      if (!student || !student.class_id) {
        throw new BadRequestException('Không tìm thấy thông tin sinh viên hoặc lớp!');
      }

      const activeSemester = await prisma.semesters.findFirst({
        where: { is_active: 1 },
        orderBy: { created_at: 'desc' },
        select: { id: true },
      });

      if (!activeSemester) {
        throw new BadRequestException('Không tìm thấy học kỳ đang hoạt động!');
      }

      form = await prisma.scoring_sheets.create({
        data: {
          id: randomUUID(),
          student_id: studentId,
          semester_id: activeSemester.id,
          class_id: student.class_id,
          status: 'DRAFT',
          current_step: 1,
        },
      });
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

    // BẮN THÔNG BÁO CHO NGƯỜI NHẬN TIẾP THEO (LỚP TRƯỞNG / CỐ VẤN)
    try {
      if (role === 'STUDENT') {
        const studentInfo = await prisma.users.findFirst({ where: { id: studentId }, select: { full_name: true, class_id: true } });
        if (studentInfo) {
          const classMonitors = await prisma.users.findMany({
            where: { class_id: studentInfo.class_id, role: 'CLASS_COMMITTEE' },
            select: { id: true }
          });
          if (classMonitors.length > 0) {
            await prisma.notifications.createMany({
              data: classMonitors.map(monitor => ({
                id: randomUUID(),
                user_id: monitor.id,
                type: 'SCORE_SUBMITTED',
                title: 'Có phiếu rèn luyện mới gửi lên',
                content: `Sinh viên ${studentInfo.full_name} đã nộp tự đánh giá điểm rèn luyện. Vui lòng chấm duyệt.`,
                is_read: 0,
              }))
            });
          }
        }
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
  async rejectForm(formId: string, role: string, studentId: string) {
    const form = await prisma.scoring_sheets.findFirst({
      where: { student_id: studentId },
      include: { score_details: true }
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

    return {
      message: 'Đã xóa phiếu điểm thành công! Sinh viên có thể bắt đầu lại từ đầu.',
      data: null,
    };
  }

  // =============================================
  // 7. ✅ TÍNH TỔNG ĐIỂM TỰ ĐỘNG
  // =============================================
  private async calculateTotals(formId: string) {
    // Lấy score_details + score_entries cho phiếu này
    const details = await prisma.score_details.findMany({
      where: { scoring_sheet_id: formId },
      select: {
        student_score: true,
        class_score: true,
        advisor_score: true,
        score_entries: {
          select: { scorer_role: true, score: true },
        },
      },
    });

    let studentTotal = 0;
    let classTotal = 0;
    let advisorTotal = 0;

    for (const d of details) {
      const entries = d.score_entries || [];
      const sEntry = entries.find((e: any) => e.scorer_role === 'STUDENT');
      const cEntry = entries.find((e: any) => e.scorer_role === 'CLASS_COMMITTEE');
      const aEntry = entries.find((e: any) => e.scorer_role === 'ADVISOR');

      studentTotal += Number(sEntry?.score ?? d.student_score ?? 0);
      classTotal += Number(cEntry?.score ?? d.class_score ?? 0);
      advisorTotal += Number(aEntry?.score ?? d.advisor_score ?? 0);
    }

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