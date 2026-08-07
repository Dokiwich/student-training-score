import { Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
import { prisma } from '@student-score/database';
import { randomUUID } from 'crypto';


export const ASSIGNED_ROLE_CODES = {
  CLASS_COMMITTEE: [
    'MONITOR',
    'VICE_MONITOR',
    'SECRETARY',
  ],
  ADVISOR: ['ADVISOR'],
} as const;

export type AssignedRoleContext = keyof typeof ASSIGNED_ROLE_CODES;
export type AssignedRoleCode = typeof ASSIGNED_ROLE_CODES[AssignedRoleContext][number];

export function isAssignedRoleCodeForContext(roleCode: string, context: AssignedRoleContext): roleCode is AssignedRoleCode {
  return (ASSIGNED_ROLE_CODES[context] as readonly string[]).includes(roleCode);
}

import { HttpException, HttpStatus } from '@nestjs/common';

export function throwAmbiguousRoleContext(): never {
  throw new HttpException({
    statusCode: 400,
    code: 'AMBIGUOUS_ROLE_CONTEXT',
    message: 'Tài khoản có nhiều phạm vi vai trò. Vui lòng sử dụng endpoint theo vai trò.'
  }, HttpStatus.BAD_REQUEST);
}

export function throwClassContextRequired(classes: { id: string; name: string }[]): never {
  throw new HttpException({
    statusCode: 400,
    code: 'CLASS_CONTEXT_REQUIRED',
    message: 'Tài khoản được phân công nhiều lớp. Vui lòng chọn lớp.',
    classes
  }, HttpStatus.BAD_REQUEST);
}

export function throwClassScopeForbidden(): never {
  throw new HttpException({
    statusCode: 403,
    code: 'CLASS_SCOPE_FORBIDDEN',
    message: 'Tài khoản chưa được phân công quản lý lớp này.'
  }, HttpStatus.FORBIDDEN);
}

export function throwInvalidClassId(): never {
  throw new HttpException({
    statusCode: 400,
    code: 'INVALID_CLASS_ID',
    message: 'Mã lớp không hợp lệ.'
  }, HttpStatus.BAD_REQUEST);
}

export function throwNoActiveSemester(): never {
  throw new HttpException({
    statusCode: 409,
    code: 'NO_ACTIVE_SEMESTER',
    message: 'Không có học kỳ đang hoạt động.'
  }, HttpStatus.CONFLICT);
}

export type SubmissionValidationError = {
  criterionId: number | null;
  code:
    | 'EVIDENCE_REQUIRED'
    | 'CRITERION_INACTIVE'
    | 'CRITERION_VERSION_MISMATCH'
    | 'SCORE_OUT_OF_RANGE'
    | 'INVALID_SCORE_DIRECTION'
    | 'QUANTITY_EXCEEDED'
    | 'MUTUALLY_EXCLUSIVE_OPTIONS'
    | 'INVALID_FORM_STATE'
    | 'DEADLINE_EXPIRED'
    | 'FORBIDDEN'
    | 'FORM_NOT_FOUND';
  message: string;
};

export type ScoringTimelineEvent = {
  id: string;
  eventType:
    | 'CREATED'
    | 'SAVED'
    | 'SUBMITTED'
    | 'RESUBMITTED'
    | 'APPROVED'
    | 'RETURNED'
    | 'SCORE_ADJUSTED'
    | 'COMMENTED'
    | 'FINALIZED';

  actorId: string | null;
  actorName: string;
  actorRole: string | null;
  actorRoleLabel: string;

  createdAt: Date;

  previousStatus: string | null;
  newStatus: string | null;

  previousScore: number | null;
  newScore: number | null;

  comment: string | null;
  reason: string | null;

  criterionId: number | null;
  criterionCode: string | null;
  criterionName: string | null;
};

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
// ⚠️ SYNC OBLIGATION: timestampField values are denormalized on scoring_sheets.
// (historically duplicated from review_actions.created_at). 
// Lưu ý (Phase 3): review_actions không còn là nguồn timeline chính, timeline chuẩn lấy từ audit_logs.
const STATE_TRANSITIONS: Record<string, {
  requiredStatus: string | string[];
  nextStatus: string;
  timestampField: string;
  errorMessage: string;
}> = {
  STUDENT: {
    requiredStatus: [WorkflowStatus.DRAFT, 'CLASS_REJECTED', 'ADVISOR_REJECTED'],
    nextStatus: WorkflowStatus.SUBMITTED,
    timestampField: 'student_submitted_at',
    errorMessage: 'Sinh viên chỉ được nộp khi phiếu đang là Bản Nháp (DRAFT) hoặc bị Trả lại (REJECTED)',
  },
  CLASS_COMMITTEE: {
    requiredStatus: WorkflowStatus.SUBMITTED,
    nextStatus: WorkflowStatus.CLASS_APPROVED,
    timestampField: 'class_reviewed_at',
    errorMessage: 'Lớp trưởng chỉ được duyệt khi Sinh viên đã nộp (SUBMITTED)',
  },
  ADVISOR: {
    requiredStatus: WorkflowStatus.CLASS_APPROVED,
    nextStatus: WorkflowStatus.ADVISOR_APPROVED,
    timestampField: 'advisor_approved_at',
    errorMessage: 'Cố vấn chỉ được chốt khi Lớp trưởng đã duyệt (CLASS_APPROVED)',
  },
};

const SCORING_PERMISSIONS: Record<string, string | string[]> = {
  STUDENT: [WorkflowStatus.DRAFT, 'CLASS_REJECTED', 'ADVISOR_REJECTED'],
  CLASS_COMMITTEE: WorkflowStatus.SUBMITTED,
  ADVISOR: WorkflowStatus.CLASS_APPROVED,
};

export type ScoringWorkflowState = {
  currentStage: 'STUDENT' | 'CLASS_COMMITTEE' | 'ADVISOR' | 'DEPARTMENT';
  currentStep: 1 | 2 | 3 | 4;
  currentHandler: 'STUDENT' | 'CLASS_COMMITTEE' | 'ADVISOR' | 'DEPARTMENT' | null;
  isReturned: boolean;
  returnedToStage: 'STUDENT' | 'CLASS_COMMITTEE' | 'ADVISOR' | 'DEPARTMENT' | null;
  statusLabel: string;
};

export function getScoringWorkflowState(status: string): ScoringWorkflowState {
  switch (status) {
    case 'DRAFT':
      return { currentStage: 'STUDENT', currentStep: 1, currentHandler: 'STUDENT', isReturned: false, returnedToStage: null, statusLabel: 'Bản nháp' };
    case 'CLASS_REJECTED':
      return { currentStage: 'STUDENT', currentStep: 1, currentHandler: 'STUDENT', isReturned: true, returnedToStage: 'STUDENT', statusLabel: 'Cần chỉnh sửa theo yêu cầu của Ban cán sự lớp' };
    case 'ADVISOR_REJECTED':
      return { currentStage: 'STUDENT', currentStep: 1, currentHandler: 'STUDENT', isReturned: true, returnedToStage: 'STUDENT', statusLabel: 'Cần chỉnh sửa theo yêu cầu của Cố vấn học tập' };
      
    case 'STUDENT_SUBMITTED':
      return { currentStage: 'CLASS_COMMITTEE', currentStep: 2, currentHandler: 'CLASS_COMMITTEE', isReturned: false, returnedToStage: null, statusLabel: 'Đã nộp cho BCS' };
    case 'CLASS_REVIEWING':
      return { currentStage: 'CLASS_COMMITTEE', currentStep: 2, currentHandler: 'CLASS_COMMITTEE', isReturned: false, returnedToStage: null, statusLabel: 'BCS đang xét duyệt' };
      
    case 'CLASS_REVIEWED':
      return { currentStage: 'ADVISOR', currentStep: 3, currentHandler: 'ADVISOR', isReturned: false, returnedToStage: null, statusLabel: 'BCS đã duyệt' };
    case 'ADVISOR_REVIEWING':
      return { currentStage: 'ADVISOR', currentStep: 3, currentHandler: 'ADVISOR', isReturned: false, returnedToStage: null, statusLabel: 'CVHT đang xét duyệt' };
      
    case 'ADVISOR_APPROVED':
      return { currentStage: 'DEPARTMENT', currentStep: 4, currentHandler: 'DEPARTMENT', isReturned: false, returnedToStage: null, statusLabel: 'CVHT đã duyệt' };
    case 'SCHOOL_REVIEWING':
      return { currentStage: 'DEPARTMENT', currentStep: 4, currentHandler: 'DEPARTMENT', isReturned: false, returnedToStage: null, statusLabel: 'Khoa đang xét duyệt' };

    case 'SCHOOL_APPROVED':
      return { currentStage: 'DEPARTMENT', currentStep: 4, currentHandler: 'DEPARTMENT', isReturned: false, returnedToStage: null, statusLabel: 'Khoa đã duyệt' };
      
    case 'SCHOOL_REJECTED':
      return { currentStage: 'ADVISOR', currentStep: 3, currentHandler: 'ADVISOR', isReturned: true, returnedToStage: 'ADVISOR', statusLabel: 'Bị Khoa trả lại' };

    case 'FINALIZED':
    case 'COMPLETED':
      return { currentStage: 'DEPARTMENT', currentStep: 4, currentHandler: null, isReturned: false, returnedToStage: null, statusLabel: 'Hoàn tất' };
      
    case 'APPEALING':
      return { currentStage: 'DEPARTMENT', currentStep: 4, currentHandler: 'DEPARTMENT', isReturned: false, returnedToStage: null, statusLabel: 'Đang khiếu nại' };

    default:
      console.warn(`[getScoringWorkflowState] Trạng thái không nhận diện được: ${status}`);
      return { 
        currentStage: 'STUDENT', 
        currentStep: 1, 
        currentHandler: null, 
        isReturned: false, 
        returnedToStage: null, 
        statusLabel: 'Trạng thái chưa được hỗ trợ' 
      };
  }
}



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
      const activeSemester = await this.resolveCurrentScoringSemester();
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
  // HELPER: Lấy active semester (Deterministic)
  // =============================================
  async resolveCurrentScoringSemester() {
    const activeSemesters = await prisma.semesters.findMany({
      where: { is_active: 1 },
      orderBy: [
        { start_date: 'desc' },
        { created_at: 'desc' }
      ],
      select: {
        id: true,
        name: true,
        academic_year: true,
        status: true,
        start_date: true,
        end_date: true,
        student_deadline: true,
        class_committee_deadline: true,
        advisor_deadline: true,
        school_deadline: true,
      }
    });

    if (activeSemesters.length > 1) {
      console.warn(`[WARNING] Multiple active semesters found. Using ${activeSemesters[0].id} deterministically.`);
    }

    return activeSemesters.length > 0 ? activeSemesters[0] : null;
  }

  // =============================================
  // HELPER: Format Dashboard Deadline Info (PURE)
  // =============================================
  private formatDashboardDeadlineInfo(semester: any | null) {
    if (!semester) {
      return {
        semester: null,
        currentPhase: 'UNKNOWN',
        currentPhaseLabel: 'Chưa xác định',
        studentSubmissionDeadline: null,
        remainingTimeText: 'Chưa thiết lập',
        isOverdue: false,
        daysLeft: 0,
      };
    }

    const deadline = semester.student_deadline ? new Date(semester.student_deadline) : null;
    let remainingTimeText = 'Chưa thiết lập';
    let isOverdue = false;
    let daysLeft = 0;

    if (deadline) {
      const now = new Date();
      const diffTime = deadline.getTime() - now.getTime();
      
      if (diffTime <= 0) {
        isOverdue = true;
        remainingTimeText = 'Đã hết hạn';
      } else {
        daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        remainingTimeText = daysLeft > 0 ? `Còn ${daysLeft} ngày` : 'Sắp hết hạn';
      }
    }

    const PHASE_LABELS: Record<string, string> = {
      UPCOMING: 'Chưa bắt đầu',
      STUDENT_SCORING: 'Sinh viên đang tự đánh giá',
      CLASS_REVIEWING: 'Ban cán sự đang đánh giá',
      ADVISOR_REVIEWING: 'CVHT đang đánh giá',
      SCHOOL_REVIEWING: 'Chờ Trường duyệt',
      FINALIZED: 'Đã hoàn tất',
      LOCKED: 'Đã kết thúc',
    };

    return {
      semester: {
        id: semester.id,
        name: semester.name,
        academicYear: semester.academic_year,
      },
      currentPhase: semester.status,
      currentPhaseLabel: PHASE_LABELS[semester.status] || semester.status,
      studentSubmissionDeadline: deadline,
      remainingTimeText,
      isOverdue,
      daysLeft,
    };
  }

  // =============================================
  // HELPER: Lấy semester kèm thông tin deadline
  // =============================================
  private async getSemesterWithDeadlines(semesterId?: string) {
    if (semesterId) {
      return prisma.semesters.findUnique({
        where: { id: semesterId },
        select: {
          id: true,
          student_deadline: true,
          class_committee_deadline: true,
          advisor_deadline: true,
          school_deadline: true,
        },
      });
    }
    return this.resolveCurrentScoringSemester();
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
    tx: any = prisma,
  ) {
    if (oldScore === newScore) return;
    await tx.score_adjustment_logs.create({
      data: {
        id: randomUUID(),
        score_detail_id: scoreDetailId,
        adjusted_by_id: adjustedById,
        old_score: oldScore,
        new_score: newScore,
        reason: reason || null,
      },
    });
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
    tx: any = prisma,
  ) {
    try {
      await tx.audit_logs.create({
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
  // HELPER: Ghi audit log quan trọng (Không bắt lỗi, nằm trong transaction)
  // =============================================
  private async logCriticalAudit(
    actorId: string,
    action: string,
    entityType: string,
    entityId: string,
    oldValue?: any,
    newValue?: any,
    tx: any = prisma,
  ) {
    await tx.audit_logs.create({
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
      const activeSemester = await this.resolveCurrentScoringSemester();
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
  // HELPER: Phân giải phạm vi lớp học (Class Scope) cho BCS / CVHT
  // =============================================
  async resolveAssignedClassScope(
    actorId: string,
    roleContext: 'CLASS_COMMITTEE' | 'ADVISOR',
    mode: 'SINGLE_CLASS' | 'ALL_ASSIGNED_CLASSES',
    requestedClassId?: string
  ) {
    const activeSemester = await this.resolveCurrentScoringSemester();
    if (!activeSemester) {
      throwNoActiveSemester();
    }

    if (requestedClassId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestedClassId)) {
      throwInvalidClassId();
    }

    const roleCodes = roleContext === 'CLASS_COMMITTEE' 
      ? ASSIGNED_ROLE_CODES.CLASS_COMMITTEE 
      : ASSIGNED_ROLE_CODES.ADVISOR;

    const userRoles = await prisma.user_roles.findMany({
      where: {
        user_id: actorId,
        is_active: 1,
        roles: { code: { in: [...roleCodes] } }
      },
      select: { entity_id: true }
    });

    let classIds = userRoles.map(r => r.entity_id).filter((id): id is string => Boolean(id));
    
    let validClasses: { id: string; name: string }[] = [];
    if (classIds.length > 0) {
      validClasses = await prisma.classes.findMany({
        where: { id: { in: classIds }, is_active: 1 },
        select: { id: true, name: true }
      });
      classIds = validClasses.map(c => c.id);
    }

    if (classIds.length === 0) {
      throwClassScopeForbidden();
    }

    if (requestedClassId && !classIds.includes(requestedClassId)) {
      throwClassScopeForbidden();
    }

    if (mode === 'SINGLE_CLASS') {
      let selectedClassId = classIds[0];
      if (classIds.length > 1) {
        if (requestedClassId) {
          selectedClassId = requestedClassId;
        } else {
          throwClassContextRequired(validClasses);
        }
      }
      return {
        semesterId: activeSemester.id,
        classIds: [selectedClassId],
        selectedClassId,
        classes: validClasses
      };
    } else {
      const finalClassIds = requestedClassId ? [requestedClassId] : classIds;
      return {
        semesterId: activeSemester.id,
        classIds: finalClassIds,
        selectedClassId: requestedClassId || null,
        classes: validClasses
      };
    }
  }

  // =============================================
  // HELPER: Phân giải phạm vi lớp học cho DEPARTMENT
  // =============================================
  async resolveDepartmentClassScope(actorId: string) {
    const activeSemester = await this.resolveCurrentScoringSemester();
    if (!activeSemester) {
      throw new BadRequestException('Không có học kỳ nào đang hoạt động.');
    }

    const user = await prisma.users.findUnique({
      where: { id: actorId },
      include: { user_roles: { include: { roles: true } } }
    });

    const isDept = user?.user_roles.some(ur => ur.roles.code === 'DEPARTMENT' && ur.is_active === 1);
    if (!isDept || !user?.department_id) {
      throw new ForbiddenException('Tài khoản không có quyền cấp Khoa.');
    }

    const deptClasses = await prisma.classes.findMany({
      where: { department_id: user.department_id },
      select: { id: true }
    });

    return {
      semesterId: activeSemester.id,
      classIds: deptClasses.map(c => c.id)
    };
  }

  // =============================================
  // API: LẤY DANH SÁCH SINH VIÊN (DÙNG CHUNG / MỚI)
  // =============================================
  async getAuthorizedStudentList(actorId: string, roleContext: 'CLASS_COMMITTEE' | 'ADVISOR' | 'DEPARTMENT', mode: 'SINGLE_CLASS' | 'ALL_ASSIGNED_CLASSES' = 'SINGLE_CLASS', requestedClassId?: string) {
    let scope;
    if (roleContext === 'DEPARTMENT') {
      scope = await this.resolveDepartmentClassScope(actorId);
    } else {
      scope = await this.resolveAssignedClassScope(actorId, roleContext, mode, requestedClassId);
    }

    // ✅ PONYTAIL: Lấy toàn bộ danh mục và tiêu chí 1 lần duy nhất (tránh N+1 query)
    const [categories, allCriteria] = await Promise.all([
      prisma.criteria_categories.findMany({ select: { id: true, max_score: true } }),
      prisma.criteria.findMany({ where: { is_active: 1 } })
    ]);

    // Lấy tất cả sinh viên cùng lớp qua semester_enrollments
    const enrollments = await prisma.semester_enrollments.findMany({
      where: {
        class_id: { in: scope.classIds },
        semester_id: scope.semesterId,
        is_active: 1,
        users: {
          is_active: 1,
          student_id: { not: null }, // Dynamic check: only students have student_id (MSSV)
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
        classes: {
          select: { name: true },
        },
        scoring_sheets: {
          select: {
            id: true,
            status: true,
            student_submitted_at: true,
            class_reviewed_at: true,
            advisor_approved_at: true,
            score_details: {
              select: {
                criteria_id: true,
                criteria: { select: { category_id: true } },
                score_entries: { select: { scorer_role: true, score: true } },
              },
            },
          },
        },
      },
      orderBy: { users: { full_name: 'asc' } },
    });

    const contextPayload = {
      semesterId: scope.semesterId,
      classIds: scope.classIds,
      selectedClassId: scope.selectedClassId || scope.classIds[0] || null,
      classes: scope.classes || []
    };

    if (enrollments.length === 0) {
      return {
        message: 'Lớp chưa có danh sách sinh viên trong học kỳ hiện tại',
        data: [],
        context: {
          ...contextPayload,
          reason: 'NO_ENROLLMENTS_FOR_CURRENT_SEMESTER'
        }
      };
    }

    // Map dữ liệu gọn cho frontend
    const data = enrollments.map((e) => {
      const s = e.users;
      const sheet = e.scoring_sheets || null;
      // ✅ 3NF: Compute totals at runtime from score_entries
      let studentTotal: number | null = null;
      let classTotal: number | null = null;
      let advisorTotal: number | null = null;
      let finalTotal: number | null = null;
      let classification: string | null = null;
      if (sheet && sheet.score_details) {
        // Sử dụng pure function để tính điểm chuẩn xác áp trần giống hệt detail view
        const totals = this.computeTotalsPure(sheet.score_details as any[], categories, allCriteria);
        studentTotal = totals.studentTotal;
        classTotal = totals.classTotal;
        advisorTotal = totals.advisorTotal;
        finalTotal = advisorTotal;
        classification = this.getClassification(finalTotal);
      }
      return {
        id: s.id,
        studentCode: s.student_id,
        name: s.full_name,
        email: s.email,
        className: e.classes?.name || null,
        formId: sheet?.id || null,
        status: sheet?.status || 'NO_SHEET',
        studentTotal,
        classTotal,
        advisorTotal,
        finalTotal,
        classification,
        studentSubmittedAt: sheet?.student_submitted_at || null,
        classReviewedAt: sheet?.class_reviewed_at || null,
        advisorApprovedAt: sheet?.advisor_approved_at || null,
      };
    });

    return {
      message: 'Lấy danh sách sinh viên thành công',
      data,
      context: contextPayload
    };
  }

  // =============================================
  // HELPER: Lấy danh sách lớp được phân công cho Advisor
  // =============================================
  async getAdvisorClasses(userId: string) {
    const scope = await this.resolveAssignedClassScope(userId, 'ADVISOR', 'ALL_ASSIGNED_CLASSES');
    
    return {
      message: 'Lấy danh sách lớp thành công',
      data: scope.classes, // Only { id, name }
      context: {
        semesterId: scope.semesterId
      }
    };
  }

  // =============================================
  // CŨ: GIỮ LẠI ĐỂ TRÁNH LỖI BACKWARD COMPATIBILITY
  // =============================================
  async getStudentListByUser(userId: string) {
    const user = await prisma.users.findUnique({
      where: { id: userId },
      include: { user_roles: { include: { roles: true } } }
    });
    if (!user) throw new ForbiddenException('Tài khoản không tồn tại.');
    
    const isDept = user.user_roles.some(ur => ur.roles.code === 'DEPARTMENT' && ur.is_active === 1);
    const isAdvisor = user.user_roles.some(ur => isAssignedRoleCodeForContext(ur.roles.code, 'ADVISOR') && ur.is_active === 1);
    const isClassCommittee = user.user_roles.some(ur => 
      isAssignedRoleCodeForContext(ur.roles.code, 'CLASS_COMMITTEE') && ur.is_active === 1
    );
    
    const activeRolesCount = [isDept, isAdvisor, isClassCommittee].filter(Boolean).length;
    
    if (activeRolesCount > 1) {
      throwAmbiguousRoleContext();
    }

    if (isDept) return this.getAuthorizedStudentList(userId, 'DEPARTMENT');
    if (isAdvisor) return this.getAuthorizedStudentList(userId, 'ADVISOR', 'ALL_ASSIGNED_CLASSES');
    if (isClassCommittee) return this.getAuthorizedStudentList(userId, 'CLASS_COMMITTEE', 'SINGLE_CLASS');
    
    throw new ForbiddenException('Tài khoản không có quyền xem danh sách sinh viên.');
  }

  // =============================================
  // 1. LẤY TOÀN BỘ TIÊU CHÍ (THEO HỌC KỲ HIỆN TẠI HOẶC CHỈ ĐỊNH)
  // =============================================
  async getAllCriteria(semesterId?: string) {
    let targetSemesterId = semesterId;
    if (!targetSemesterId) {
      const activeSemester = await this.resolveCurrentScoringSemester();
      if (!activeSemester) {
        return {
          message: 'Không có học kỳ nào đang hoạt động',
          data: [],
        };
      }
      targetSemesterId = activeSemester.id;
    }

    const activeVersion = await prisma.criteria_versions.findFirst({
      where: {
        semester_id: targetSemesterId,
        is_active: 1,
      },
      orderBy: { created_at: 'desc' },
    });

    if (!activeVersion) {
      return {
        message: 'Không tìm thấy phiên bản tiêu chí cho học kỳ này',
        data: [],
      };
    }

    const criteriaList = await prisma.criteria.findMany({
      where: { 
        is_active: 1,
        criteria_categories: {
          criteria_version_id: activeVersion.id,
        }
      },
      orderBy: [{ sort_order: 'asc' }, { code: 'asc' }, { id: 'asc' }],
    });

    return {
      message: 'Lấy danh mục tiêu chí thành công',
      data: criteriaList,
    };
  }

  // =============================================
  // HELPER: Xác định quyền ĐỌC phiếu điểm
  // =============================================
  private async verifyReadPermission(actorId: string, studentId: string, targetSemesterId: string): Promise<void> {
    if (actorId === studentId) return;

    const actorRoles = await prisma.user_roles.findMany({
      where: { user_id: actorId, is_active: 1 },
      include: { roles: true }
    });

    if (actorRoles.some(r => r.roles.code === 'SCHOOL_ADMIN')) {
      return;
    }

    const isDepartment = actorRoles.some(r => r.roles.code === 'DEPARTMENT');
    if (isDepartment) {
      // ✅ PONYTAIL: Gộp truy vấn user
      const [actor, student] = await Promise.all([
        prisma.users.findUnique({ where: { id: actorId } }),
        prisma.users.findUnique({ where: { id: studentId } })
      ]);
      if (actor?.department_id && actor.department_id === student?.department_id) {
        return;
      }
    }

    if (targetSemesterId) {
      const enrollment = await this.resolveEnrollment(studentId, targetSemesterId);
      if (enrollment && enrollment.class_id) {
        try {
          await this.resolveAssignedClassScope(actorId, 'CLASS_COMMITTEE', 'SINGLE_CLASS', enrollment.class_id);
          return;
        } catch { /* not a committee member for this class */ }
        
        try {
          await this.resolveAssignedClassScope(actorId, 'ADVISOR', 'SINGLE_CLASS', enrollment.class_id);
          return;
        } catch { /* not an advisor for this class */ }
      }
    }

    throw new ForbiddenException('Bạn không có quyền xem phiếu điểm của sinh viên này.');
  }

  // =============================================
  // 2. LẤY TOÀN BỘ ĐIỂM + TRẠNG THÁI PHIẾU
  //    ✅ MỚI: Trả thêm formStatus để Frontend biết khóa/mở
  // =============================================
  async getScoresByFormId(formId: string, studentId: string, actorId: string, semesterId?: string) {
    let targetSemesterId = semesterId;
    if (!targetSemesterId) {
      const activeSemester = await this.resolveCurrentScoringSemester();
      if (!activeSemester) throw new BadRequestException('Không tìm thấy học kỳ đang hoạt động!');
      targetSemesterId = activeSemester.id;
    }

    await this.verifyReadPermission(actorId, studentId, targetSemesterId);

    const sheet = await this.getOrCreateDraftSheet(studentId, targetSemesterId);
    const form = {
      id: sheet.id,
      status: sheet.status,
      rejection_reason: sheet.rejection_reason,
      student_submitted_at: sheet.student_submitted_at,
      class_reviewed_at: sheet.class_reviewed_at,
      advisor_approved_at: sheet.advisor_approved_at,
    };

    // ponytail: score_details (phiếu chi tiết) chạy song song với enrollment + categories + allCriteria
    // Loại bỏ truy vấn trùng lặp score_details trong calculateTotals bằng cách tính totals từ data đã fetch
    const [scores, enrollmentData, categories, allCriteria] = await Promise.all([
      prisma.score_details.findMany({
        where: { scoring_sheet_id: form.id },
        include: { criteria: true, score_entries: true },
        orderBy: { criteria_id: 'asc' },
      }),
      prisma.semester_enrollments.findUnique({
        where: { id: sheet.enrollment_id },
        include: {
          users: true,
          classes: { include: { departments: true } },
          semesters: true
        }
      }),
      prisma.criteria_categories.findMany({
        select: { id: true, max_score: true },
      }),
      prisma.criteria.findMany({
        where: { is_active: 1 },
      }),
    ]);

    const workflowState = getScoringWorkflowState(form.status);

    // ponytail: tính totals từ data đã có, không gọi calculateTotals (tránh re-query score_details)
    const totals = this.computeTotalsPure(scores as any[], categories, allCriteria);

    const studentInfo = {
      name: enrollmentData?.users?.full_name || '',
      studentId: enrollmentData?.users?.student_id || '',
      className: enrollmentData?.classes?.name || '',
      departmentName: enrollmentData?.classes?.departments?.name || '',
    };

    return {
      message: 'Lấy danh sách điểm thành công',
      data: scores,
      formId: form.id,
      formStatus: form.status,
      formStatusDetail: form.status,
      currentStep: workflowState.currentStep,
      currentStage: workflowState.currentStage,
      currentHandler: workflowState.currentHandler,
      isReturned: workflowState.isReturned,
      returnedToStage: workflowState.returnedToStage,
      statusLabel: workflowState.statusLabel,
      rejectionReason: form.rejection_reason || null,
      studentInfo,
      semesterName: enrollmentData?.semesters ? `Học kỳ ${enrollmentData.semesters.name} - Năm học ${enrollmentData.semesters.academic_year}` : '',
      totals: {
        student: totals.studentTotal,
        class: totals.classTotal,
        advisor: totals.advisorTotal,
        final: totals.advisorTotal,
      },
      timestamps: {
        studentSubmittedAt: form.student_submitted_at,
        classReviewedAt: form.class_reviewed_at,
        advisorApprovedAt: form.advisor_approved_at,
      },
    };
  }

  // =============================================
  // HELPER: Xác định và kiểm tra quyền thực tế của người thao tác
  // =============================================
  private async verifyActorRole(actorId: string, studentId: string, requestedRole: string, targetSemesterId: string): Promise<void> {
    // 1. Nếu requestedRole là STUDENT, bắt buộc actorId phải là studentId
    if (requestedRole === 'STUDENT') {
      if (actorId !== studentId) {
        throw new ForbiddenException('Chỉ sinh viên mới được thao tác với tư cách STUDENT trên phiếu của mình.');
      }
      return;
    }

    // 2. Nếu là CLASS_COMMITTEE hoặc ADVISOR, kiểm tra qua role assignment mới
    if (!targetSemesterId) {
      throw new BadRequestException('Không tìm thấy học kỳ hoạt động.');
    }

    const enrollment = await this.resolveEnrollment(studentId, targetSemesterId);
    if (!enrollment || !enrollment.class_id) {
      throw new BadRequestException('Không tìm thấy thông tin lớp học của sinh viên.');
    }

    if (requestedRole === 'CLASS_COMMITTEE') {
      await this.resolveAssignedClassScope(actorId, 'CLASS_COMMITTEE', 'SINGLE_CLASS', enrollment.class_id);
      return;
    }

    if (requestedRole === 'ADVISOR') {
      await this.resolveAssignedClassScope(actorId, 'ADVISOR', 'SINGLE_CLASS', enrollment.class_id);
      return;
    }

    throw new BadRequestException(`Vai trò "${requestedRole}" không hợp lệ.`);
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
    targetSemesterId: string,
    proofUrl?: string,
  ) {
    criteriaId = Number(criteriaId);
    score = Number(score);
    if (isNaN(criteriaId)) throw new BadRequestException('ID tiêu chí không hợp lệ!');
    if (isNaN(score)) throw new BadRequestException('Điểm không hợp lệ!');

    // ✅ PONYTAIL: Gộp các truy vấn độc lập thành 1 Promise.all (Tiết kiệm 5 round-trips)
    const [form, semester, criteria, childrenCount, activeVersion] = await Promise.all([
      this.getOrCreateDraftSheet(studentId, targetSemesterId),
      this.getSemesterWithDeadlines(targetSemesterId),
      prisma.criteria.findUnique({
        where: { id: criteriaId },
        include: { criteria_categories: true },
      }),
      prisma.criteria.count({
        where: { parent_id: criteriaId, is_active: 1 },
      }),
      prisma.criteria_versions.findFirst({
        where: { semester_id: targetSemesterId, is_active: 1 },
      })
    ]);

    // 3b. ✅ KIỂM TRA QUYỀN CHẤM ĐIỂM THEO ROLE
    const allowedStatus = SCORING_PERMISSIONS[role];

    if (!allowedStatus) {
      throw new BadRequestException(
        `Vai trò "${role}" không hợp lệ. Chỉ chấp nhận: STUDENT, CLASS_COMMITTEE, ADVISOR`,
      );
    }

    const isAllowed = Array.isArray(allowedStatus) 
      ? allowedStatus.includes(form.status) 
      : form.status === allowedStatus;

    if (!isAllowed) {
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
        CLASS_REJECTED: 'Bị BCS trả lại',
        ADVISOR_REJECTED: 'Bị CVHT trả lại',
      };

      const allowedStatusStr = Array.isArray(allowedStatus)
        ? allowedStatus.map(s => statusLabels[s] || s).join(' hoặc ')
        : statusLabels[allowedStatus as string] || allowedStatus;

      throw new BadRequestException(
        `${roleLabels[role]} chỉ được chấm khi phiếu ở trạng thái "${allowedStatusStr}". ` +
        `Hiện tại phiếu đang ở: "${statusLabels[form.status] || form.status}"`,
      );
    }

    // 3b-2. ✅ KIỂM TRA HẠN CHÓT THEO ROLE
    if (semester) {
      this.checkDeadline(role, semester);
    }

    // 3c. Kiểm tra tiêu chí
    if (!criteria) {
      throw new BadRequestException('Không tìm thấy tiêu chí!');
    }

    if (!criteria.is_active) {
      throw new BadRequestException('Tiêu chí này đã bị vô hiệu hóa!');
    }

    // ✅ MỚI: Cross-Semester Injection (Chống ném điểm tiêu chí khác học kỳ)
    if (activeVersion && criteria.criteria_categories?.criteria_version_id !== activeVersion.id) {
      throw new BadRequestException('Tiêu chí này không thuộc về học kỳ hiện tại của phiếu điểm!');
    }

    // ✅ MỚI: Chống ném điểm trực tiếp vào danh mục cha
    if (childrenCount > 0) {
      throw new BadRequestException('Không thể chấm điểm trực tiếp vào danh mục cha (cần chấm ở các mục con)!');
    }

    // ✅ MỚI: Cưỡng chế nhập minh chứng nếu yêu cầu
    if (criteria.require_evidence === 1 && role === 'STUDENT' && (!proofUrl || proofUrl.trim() === '')) {
      throw new BadRequestException(`Tiêu chí "${criteria.code}" bắt buộc phải có link minh chứng!`);
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
    // point KHÔNG giới hạn ở leaf — chỉ giới hạn bởi trần điểm mục cha (frontend tính)
    if (isQuantityBased) {
      const multiplier = QUANTITY_MULTIPLIERS[criteria.code];
      const absMultiplier = Math.abs(multiplier);
      const inputQuantity = Math.abs(score) / absMultiplier;
      const isDeduction = criteria.score_type === 'DEDUCTION' || criteria.point < 0;
      const maxQuantity = isDeduction ? 40 : 30;
      
      if (inputQuantity > maxQuantity) {
        throw new BadRequestException(`Số lượng không được vượt quá ${maxQuantity} lần (tiêu chí "${criteria.code}")`);
      }
    } else if (criteria.score_type === 'DEDUCTION' || criteria.point < 0) {
      // Đối với tiêu chí điểm trừ (deduction), điểm là số âm (ví dụ: -2)
      // Điểm hợp lệ phải nằm trong khoảng [point, 0] (ví dụ: [-2, 0])
      if (score < criteria.point) {
        throw new BadRequestException(
          `Điểm không được thấp hơn ${criteria.point} (tiêu chí "${criteria.code}")`,
        );
      }
      if (score > 0) {
        throw new BadRequestException(
          `Điểm không được vượt quá 0 (tiêu chí "${criteria.code}")`,
        );
      }
    } else {
      // Đối với tiêu chí điểm cộng thông thường
      if (score < 0) {
        throw new BadRequestException(
          `Điểm không được thấp hơn 0 (tiêu chí "${criteria.code}")`,
        );
      }
      // ✅ FIX: Kiểm tra score không được vượt quá point
      // Trước đây bỏ check ở đây dẫn đến lỗi Decimal(5,2) overflow → 500 khi nhập số quá lớn
      if (!isQuantityBased && criteria.point > 0 && score > criteria.point) {
        throw new BadRequestException(
          `Điểm không được vượt quá ${criteria.point} (tiêu chí "${criteria.code}")`,
        );
      }
    }

    return { form, criteria };
  }

  // =============================================
  // HELPER: enforceMutualExclusivity (Check 2 lần tránh gian lận)
  // =============================================
  private async enforceMutualExclusivity(tx: any, formId: string, criteriaId: number, role: string) {
    // ✅ PONYTAIL: Gộp 3 queries (target, parent, siblings) thành 1 nhờ Prisma include
    const target = await tx.criteria.findUnique({
      where: { id: criteriaId },
      include: {
        criteria: { // relation to parent
          select: {
            score_type: true,
            other_criteria: { // relation to siblings (including self)
              select: { id: true }
            }
          }
        }
      }
    });

    if (!target || !target.criteria) return;
    
    const parentScoreType = target.criteria.score_type;
    if (parentScoreType !== 'RADIO' && parentScoreType !== 'OPTIONS') return;

    const siblingIds = target.criteria.other_criteria
      .map((s: any) => s.id)
      .filter((id: number) => id !== criteriaId);

    if (siblingIds.length > 0) {
      // ✅ PONYTAIL: Gộp lệnh find score_details và delete score_entries thành 1
      await tx.score_entries.deleteMany({
        where: {
          scorer_role: role,
          score_details: {
            scoring_sheet_id: formId,
            criteria_id: { in: siblingIds }
          }
        }
      });
    }
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
    await this.validateBeforeScore(formId, criteriaId, score, 'STUDENT', studentId, undefined, proofUrl);

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

    const detail = await prisma.$transaction(async (tx) => {
      const savedDetail = await tx.score_details.upsert({
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
      await tx.score_entries.upsert({
        where: {
          score_detail_id_scorer_role: {
            score_detail_id: savedDetail.id,
            scorer_role: 'STUDENT',
          },
        },
        update: { score, scored_at: new Date() },
        create: {
          id: randomUUID(),
          score_detail_id: savedDetail.id,
          scorer_role: 'STUDENT',
          score,
        },
      });

      // ✅ enforce mutual exclusivity (Check 2 lần tránh gian lận)
      await this.enforceMutualExclusivity(tx, formId, criteriaId, 'STUDENT');

      // ✅ Ghi log điều chỉnh điểm (nếu điểm cũ khác điểm mới)
      if (oldStudentScore !== null && oldStudentScore !== score) {
        await this.logScoreAdjustment(savedDetail.id, studentId, oldStudentScore, score, 'Sinh viên tự chấm điểm', tx);
      }

      // ✅ Ghi audit log
      await this.logCriticalAudit(studentId, 'SCORE_CRITERIA', 'score_details', savedDetail.id,
        { criteria_id: criteriaId, old_score: oldStudentScore },
        { criteria_id: criteriaId, new_score: score, role: 'STUDENT' },
        tx
      );

      return savedDetail;
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
  
  // =============================================
  // GET NORMALIZED SCORING HISTORY
  // =============================================
  private buildNormalizedScoringHistoryPure(
    form: any,
    scoreDetails: any[],
    auditLogs: any[],
    adjustLogs: any[],
    classRoles: any[]
  ): ScoringTimelineEvent[] {
    const events: ScoringTimelineEvent[] = [];
    const ROLE_MAP: Record<string, string> = {
      STUDENT: 'Sinh viên',
      CLASS_COMMITTEE: 'Ban cán sự lớp',
      ADVISOR: 'Cố vấn học tập',
      SCHOOL: 'Khoa',
      SYSTEM: 'Hệ thống'
    };

    const mapActionToEvent = (action: string): ScoringTimelineEvent['eventType'] | null => {
      if (action === 'SUBMIT_FORM') return 'SUBMITTED';
      if (action === 'APPROVE_FORM') return 'APPROVED';
      if (action === 'REJECT_FORM') return 'RETURNED';
      if (action === 'FINALIZE_FORM') return 'FINALIZED';
      if (action === 'CREATE_FORM') return 'CREATED';
      return null;
    };

    const monitorRoleCodes = ASSIGNED_ROLE_CODES.CLASS_COMMITTEE;
    const monitorIds = new Set(classRoles.filter(r => monitorRoleCodes.includes(r.roles.code as any)).map(r => r.user_id));
    const advisorIds = new Set(classRoles.filter(r => ASSIGNED_ROLE_CODES.ADVISOR.includes(r.roles.code as any)).map(r => r.user_id));

    const inferActorRole = (aId: string) => {
      if (aId === form.semester_enrollments.user_id) return 'STUDENT';
      if (monitorIds.has(aId)) return 'CLASS_COMMITTEE';
      if (advisorIds.has(aId)) return 'ADVISOR';
      return null;
    };

    const normalizeScoreValue = (value: unknown): number | null => {
      if (value === null || value === undefined || value === '') {
        return null;
      }
      const numericValue = Number(value);
      return Number.isFinite(numericValue) ? numericValue : null;
    };

    const matchedAdjustmentIds = new Set<string>();

    const findMatchingAdjustment = (detailId: string, actorId: string, oldScore: number | null, newScore: number | null, logTime: number) => {
       return adjustLogs.find(adj => {
           if (matchedAdjustmentIds.has(adj.id)) return false;

           const timeDiff = Math.abs(adj.created_at.getTime() - logTime);
           return adj.score_detail_id === detailId 
               && adj.adjusted_by_id === actorId
               && normalizeScoreValue(adj.old_score) === oldScore
               && normalizeScoreValue(adj.new_score) === newScore
               && timeDiff <= 5000; // within 5 seconds
       });
    };

    const detailMap = new Map(scoreDetails.map(d => [d.id, d]));
    const entryToDetailMap = new Map();
    for (const d of scoreDetails) {
       if (d.score_entries) {
          for (const e of d.score_entries) {
             entryToDetailMap.set(e.id, d.id);
          }
       }
    }

    // 1. Map score adjustments
    for (const adj of adjustLogs) {
      const actorRole = inferActorRole(adj.adjusted_by_id);
      
      events.push({
        id: `adj-${adj.id}`,
        eventType: 'SCORE_ADJUSTED',
        actorId: adj.adjusted_by_id,
        actorName: adj.users?.full_name || 'Không xác định',
        actorRole: actorRole,
        actorRoleLabel: actorRole ? ROLE_MAP[actorRole] : 'Người dùng',
        createdAt: adj.created_at,
        previousStatus: null,
        newStatus: null,
        previousScore: normalizeScoreValue(adj.old_score),
        newScore: normalizeScoreValue(adj.new_score),
        comment: null,
        reason: adj.reason,
        criterionId: adj.score_details?.criteria?.id || null,
        criterionCode: adj.score_details?.criteria?.code || null,
        criterionName: adj.score_details?.criteria?.content || null,
      });
    }

    // 2. Map audit logs
    for (const log of auditLogs) {
      const oldVal: any = log.old_value || {};
      const newVal: any = log.new_value || {};

      if (log.action === 'SCORE_CRITERIA' || log.action === 'DELETE_CRITERIA_SCORE') {
         let detailId = log.entity_type === 'score_details' ? log.entity_id : null;
         
         if (log.entity_type === 'score_entries') {
            const critId = oldVal.criteria_id || newVal.criteria_id;
            if (critId) {
                const foundDetail = Array.from(detailMap.values()).find(d => d.criteria_id === critId);
                if (foundDetail) detailId = foundDetail.id;
            } else {
                const mappedDetailId = entryToDetailMap.get(log.entity_id);
                if (mappedDetailId) detailId = mappedDetailId;
            }
         }

         if (detailId) {
            const detail = detailMap.get(detailId);
            if (detail) {
                const oldScore = normalizeScoreValue(oldVal.old_score);
                const newScore = normalizeScoreValue(newVal.new_score);
                
                // Check if this audit log has a matching score adjustment log
                const matchingAdj = findMatchingAdjustment(detailId, log.actor_id, oldScore, newScore, log.created_at.getTime());
                
                if (matchingAdj) {
                    matchedAdjustmentIds.add(matchingAdj.id);
                } else {
                    const actorRole = newVal.actor_role || newVal.role || inferActorRole(log.actor_id);
                    events.push({
                      id: `audit-${log.id}`,
                      eventType: 'SCORE_ADJUSTED',
                      actorId: log.actor_id,
                      actorName: log.users?.full_name || 'Hệ thống',
                      actorRole: actorRole,
                      actorRoleLabel: actorRole ? ROLE_MAP[actorRole] : 'Hệ thống',
                      createdAt: log.created_at,
                      previousStatus: null,
                      newStatus: null,
                      previousScore: oldScore,
                      newScore: newScore,
                      comment: null,
                      reason: null,
                      criterionId: detail.criteria?.id || null,
                      criterionCode: detail.criteria?.code || null,
                      criterionName: detail.criteria?.content || null,
                    });
                }
            }
         }
         continue;
      }

      let eventType = mapActionToEvent(log.action);
      if (!eventType) continue;
      
      if (eventType === 'SUBMITTED' && oldVal.status && oldVal.status.includes('REJECTED')) {
        eventType = 'RESUBMITTED';
      }

      const role = newVal.role || inferActorRole(log.actor_id);

      events.push({
        id: `audit-${log.id}`,
        eventType,
        actorId: log.actor_id,
        actorName: log.users?.full_name || 'Hệ thống',
        actorRole: role,
        actorRoleLabel: role ? ROLE_MAP[role] : 'Hệ thống',
        createdAt: log.created_at,
        previousStatus: oldVal.status || null,
        newStatus: newVal.status || null,
        previousScore: null,
        newScore: null,
        comment: null,
        reason: newVal.reason || null,
        criterionId: null,
        criterionCode: null,
        criterionName: null,
      });
    }

    // Sort all events by createdAt ascending
    events.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    return events;
  }

  async getNormalizedScoringHistory(formId: string, actorId: string): Promise<ScoringTimelineEvent[]> {
    // Auth check via sheet
    const form = await prisma.scoring_sheets.findUnique({
      where: { id: formId },
      include: { semester_enrollments: true },
    });
    if (!form) return [];

    await this.verifyReadPermission(actorId, form.semester_enrollments.user_id, form.semester_enrollments.semester_id);

    const scoreDetails = await prisma.score_details.findMany({
      where: { scoring_sheet_id: formId },
      include: { criteria: true, score_entries: true },
    });
    const detailIds = scoreDetails.map(d => d.id);
    const entryIds = scoreDetails.flatMap(d => d.score_entries || []).map(e => e.id);

    const [auditLogs, adjustLogs, classRoles] = await Promise.all([
      prisma.audit_logs.findMany({
        where: {
          OR: [
            { entity_type: 'scoring_sheets', entity_id: formId },
            { entity_type: 'score_details', entity_id: { in: detailIds } },
            { entity_type: 'score_entries', entity_id: { in: entryIds } },
          ]
        },
        include: { users: { select: { full_name: true } } },
        orderBy: { created_at: 'asc' },
      }),
      prisma.score_adjustment_logs.findMany({
        where: { score_detail_id: { in: detailIds } },
        include: { users: { select: { full_name: true } }, score_details: { include: { criteria: true } } },
        orderBy: { created_at: 'asc' },
      }),
      prisma.user_roles.findMany({
        where: { entity_id: form.semester_enrollments.class_id, is_active: 1 },
        include: { roles: true }
      })
    ]);

    return this.buildNormalizedScoringHistoryPure(form, scoreDetails, auditLogs, adjustLogs, classRoles);
  }

  // =============================================
  // GET SCORING PROGRESS (TIMELINE)
  // =============================================
  
  // =============================================
  // 6.2 BULK ACTIONS
  // =============================================
  
  private mapBulkActionError(err: any): { code: string; message: string } {
    const response = err.response || {};
    const resMsg: string = (typeof response.message === 'string' ? response.message : err.message) || '';

    if (err.name === 'ForbiddenException' || err.status === 403) {
      return { code: 'FORBIDDEN', message: 'Bạn không có quyền xử lý phiếu này.' };
    }

    if (err.name === 'NotFoundException' || err.status === 404) {
      return { code: 'NOT_FOUND', message: 'Không tìm thấy phiếu.' };
    }

    if (err.name === 'BadRequestException' || err.status === 400) {
      if (resMsg === 'STALE_STATUS') {
        return { code: 'STALE_STATUS', message: 'Trạng thái phiếu đã thay đổi, vui lòng tải lại trang.' };
      }
      if (resMsg.includes('quá thời hạn') || resMsg.includes('hết hạn')) {
        return { code: 'DEADLINE_EXPIRED', message: resMsg };
      }
      if (resMsg.includes('Không tìm thấy')) {
        return { code: 'NOT_FOUND', message: 'Không tìm thấy phiếu.' };
      }
      if (resMsg.includes('quyền')) {
        return { code: 'FORBIDDEN', message: 'Bạn không có quyền xử lý phiếu này.' };
      }
      if (resMsg.includes('trạng thái') || resMsg.includes('chỉ được')) {
        return { code: 'INVALID_STATUS', message: resMsg };
      }
      if (response.errors && Array.isArray(response.errors)) {
        return { code: 'VALIDATION_FAILED', message: response.errors[0] };
      }
      return { code: 'VALIDATION_FAILED', message: resMsg };
    }

    return { code: 'UNKNOWN_ERROR', message: 'Lỗi không xác định khi xử lý phiếu.' };
  }

  private isAuthorizationError(code: string): boolean {
    return code === 'FORBIDDEN' || code === 'NOT_FOUND';
  }

  private async mapWithConcurrency<T, R>(
    items: T[],
    concurrency: number,
    worker: (item: T, index: number) => Promise<R>,
  ): Promise<R[]> {
    const results: R[] = new Array(items.length);
    let currentIndex = 0;
    
    const next = async (): Promise<void> => {
      while (currentIndex < items.length) {
        const index = currentIndex++;
        results[index] = await worker(items[index], index);
      }
    };
    
    const workers = Array(Math.min(concurrency, items.length)).fill(null).map(() => next());
    await Promise.all(workers);
    return results;
  }

  private validateBulkRequestAndGetUUIDs(formIds: any[]): string[] {
    if (!Array.isArray(formIds) || formIds.length === 0) {
      throw new BadRequestException('Danh sách phiếu không hợp lệ hoặc trống.');
    }

    if (formIds.length > 50) {
      throw new BadRequestException('Chỉ hỗ trợ tối đa 50 phiếu mỗi lần.');
    }
    
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const invalidFormat = formIds.some(id => typeof id !== 'string' || !uuidRegex.test(id.trim()));
    if (invalidFormat) {
      throw new BadRequestException('Định dạng ID phiếu không hợp lệ.');
    }
    
    const uniqueIds = [...new Set(formIds.map(id => id.trim()))];
    return uniqueIds;
  }

  private async getFormsMetadata(formIds: string[]) {
    const formsMeta = await prisma.scoring_sheets.findMany({
      where: { id: { in: formIds } },
      include: {
        semester_enrollments: {
          include: {
            users: true
          }
        }
      }
    });
    
    const metaMap = new Map();
    for (const f of formsMeta) {
      metaMap.set(f.id, {
        studentId: f.semester_enrollments?.users?.id || null,
        studentCode: f.semester_enrollments?.users?.student_id || null,
        studentName: f.semester_enrollments?.users?.full_name || null,
        previousStatus: f.status
      });
    }
    return metaMap;
  }

  async bulkApprove(formIds: any[], role: string, actorId: string) {
    const uniqueIds = this.validateBulkRequestAndGetUUIDs(formIds);
    let succeeded = 0;
    let failed = 0;

    const metaMap = await this.getFormsMetadata(uniqueIds);
    const nullMeta = { studentId: null, studentCode: null, studentName: null, previousStatus: null };

    const results = await this.mapWithConcurrency(uniqueIds, 5, async (formId) => {
      const meta = metaMap.get(formId) || nullMeta;
      try {
        const { warnings, transition } = await this.approveSingleFormInternal(formId, role, actorId);
        succeeded++;
        return {
          formId,
          ...meta,
          success: true as const,
          newStatus: transition.nextStatus,
          warnings: warnings && warnings.length > 0 ? warnings : undefined
        };
      } catch (err: any) {
        failed++;
        const mappedError = this.mapBulkActionError(err);
        const safeMeta = this.isAuthorizationError(mappedError.code) ? nullMeta : meta;
        return {
          formId,
          ...safeMeta,
          success: false as const,
          code: mappedError.code,
          message: mappedError.message
        };
      }
    });

    return {
      summary: {
        requested: formIds.length,
        unique: uniqueIds.length,
        succeeded,
        failed
      },
      results
    };
  }

  async bulkReject(formIds: any[], role: string, actorId: string, reason: string) {
    const uniqueIds = this.validateBulkRequestAndGetUUIDs(formIds);
    
    if (typeof reason !== 'string') {
      throw new BadRequestException('Lý do phải là chuỗi văn bản.');
    }
    const cleanReason = reason.trim();
    if (cleanReason.length < 5 || cleanReason.length > 500) {
      throw new BadRequestException('Lý do trả lại phải từ 5 đến 500 ký tự.');
    }

    let succeeded = 0;
    let failed = 0;

    const metaMap = await this.getFormsMetadata(uniqueIds);
    const nullMeta = { studentId: null, studentCode: null, studentName: null, previousStatus: null };

    const results = await this.mapWithConcurrency(uniqueIds, 5, async (formId) => {
      const meta = metaMap.get(formId) || nullMeta;
      try {
        const { warnings } = await this.rejectSingleFormInternal(formId, role, actorId, cleanReason);
        succeeded++;
        return {
          formId,
          ...meta,
          success: true as const,
          newStatus: role === 'CLASS_COMMITTEE' ? 'CLASS_REJECTED' : 'ADVISOR_REJECTED',
          warnings: warnings && warnings.length > 0 ? warnings : undefined
        };
      } catch (err: any) {
        failed++;
        const mappedError = this.mapBulkActionError(err);
        const safeMeta = this.isAuthorizationError(mappedError.code) ? nullMeta : meta;
        return {
          formId,
          ...safeMeta,
          success: false as const,
          code: mappedError.code,
          message: mappedError.message
        };
      }
    });

    return {
      summary: {
        requested: formIds.length,
        unique: uniqueIds.length,
        succeeded,
        failed
      },
      results
    };
  }

  async getScoringProgress(studentId: string, actorId: string, sheetId?: string, semesterId?: string) {
    let targetSemesterId = semesterId;
    if (!targetSemesterId && !sheetId) {
      const activeSemester = await this.resolveCurrentScoringSemester();
      if (!activeSemester) throw new BadRequestException('Không tìm thấy học kỳ hoạt động');
      targetSemesterId = activeSemester.id;
    }

    let form;
    if (sheetId) {
      form = await prisma.scoring_sheets.findUnique({
        where: { id: sheetId },
        include: {
          semester_enrollments: { include: { classes: true, semesters: true, users: true } },
        }
      });
    } else {
      form = await prisma.scoring_sheets.findFirst({
        where: {
          semester_enrollments: {
            user_id: studentId,
            semester_id: targetSemesterId
          }
        },
        include: {
          semester_enrollments: { include: { classes: true, semesters: true, users: true } },
        }
      });
    }

    if (!form) {
      return { 
        statusInfo: { dbStatus: 'NO_SHEET', statusLabel: 'Chưa khởi tạo', isLocked: false, isCompleted: false }, 
        progress: { currentStageIndex: 1, totalStages: 4, isReturned: false }, 
        scores: { studentScore: 0, classCommitteeScore: 0, advisorScore: 0, finalScore: 0 }, 
        summary: { selectedCriteriaCount: 0 },
        stages: [] 
      };
    }
    
    // Auth check (once)
    await this.verifyReadPermission(actorId, form.semester_enrollments.user_id, form.semester_enrollments.semester_id);

    // Shared data loading
    const [scoreDetails, categories, allCriteria] = await Promise.all([
      prisma.score_details.findMany({
        where: { scoring_sheet_id: form.id },
        include: { criteria: true, score_entries: true }
      }),
      prisma.criteria_categories.findMany({ select: { id: true, max_score: true } }),
      prisma.criteria.findMany({ where: { is_active: 1 } })
    ]);

    const detailIds = scoreDetails.map(d => d.id);
    const entryIds = scoreDetails.flatMap(d => d.score_entries || []).map(e => e.id);

    const [auditLogs, adjustLogs, classRoles] = await Promise.all([
      prisma.audit_logs.findMany({
        where: {
          OR: [
            { entity_type: 'scoring_sheets', entity_id: form.id },
            { entity_type: 'score_details', entity_id: { in: detailIds } },
            { entity_type: 'score_entries', entity_id: { in: entryIds } },
          ]
        },
        include: { users: { select: { full_name: true } } },
        orderBy: { created_at: 'asc' },
      }),
      prisma.score_adjustment_logs.findMany({
        where: { score_detail_id: { in: detailIds } },
        include: { users: { select: { full_name: true } }, score_details: { include: { criteria: true } } },
        orderBy: { created_at: 'asc' },
      }),
      prisma.user_roles.findMany({
        where: { entity_id: form.semester_enrollments.class_id, is_active: 1 },
        include: { roles: true }
      })
    ]);

    const history = this.buildNormalizedScoringHistoryPure(form, scoreDetails, auditLogs, adjustLogs, classRoles);

    const semester = form.semester_enrollments.semesters;

    const totals = this.computeTotalsPure(scoreDetails as any[], categories, allCriteria);

    const workflowState = getScoringWorkflowState(form.status);

    const stages = [
      {
        stageIndex: 1,
        roleLabel: 'Sinh viên',
        deadline: semester?.student_deadline,
      },
      {
        stageIndex: 2,
        roleLabel: 'Ban cán sự lớp',
        deadline: semester?.class_committee_deadline,
      },
      {
        stageIndex: 3,
        roleLabel: 'Cố vấn học tập',
        deadline: semester?.advisor_deadline,
      },
      {
        stageIndex: 4,
        roleLabel: 'Khoa',
        deadline: semester?.school_deadline,
      }
    ];

    const roleMap: Record<string, string> = {
       STUDENT: 'Sinh viên',
       CLASS_COMMITTEE: 'Ban cán sự lớp',
       ADVISOR: 'Cố vấn học tập',
       SCHOOL: 'Khoa'
    };

    return {
      sheetId: form.id,
      semesterInfo: { id: semester?.id, name: semester?.name, academicYear: semester?.academic_year },
      statusInfo: {
        dbStatus: form.status,
        statusLabel: workflowState.statusLabel,
        isLocked: ['FINALIZED', 'APPEALING'].includes(form.status),
        isCompleted: form.status === 'FINALIZED' || form.status === 'COMPLETED'
      },
      progress: {
        currentStep: workflowState.currentStep,
        currentStage: workflowState.currentStage,
        currentStageIndex: workflowState.currentStep,
        totalStages: 4,
        isReturned: workflowState.isReturned,
        returnedToStage: workflowState.returnedToStage,
        currentHandler: {
          role: workflowState.currentHandler,
          roleLabel: workflowState.currentHandler ? roleMap[workflowState.currentHandler] : null,
          organizationName: form.semester_enrollments.classes?.name
        }
      },
      scores: {
        studentScore: totals.studentTotal,
        classCommitteeScore: totals.classTotal,
        advisorScore: totals.advisorTotal,
        finalScore: totals.advisorTotal 
      },
      summary: {
        selectedCriteriaCount: detailIds.length
      },
      stages,
      history
    };
  }

  // =============================================
  // STUDENT DASHBOARD AGGREGATION
  // =============================================
  async getStudentDashboard(userId: string) {
    const activeSemester = await this.resolveCurrentScoringSemester();
    if (!activeSemester) {
      return {
        semester: null,
        deadline: this.formatDashboardDeadlineInfo(null),
        sheet: null,
        progress: {
          statusInfo: { dbStatus: 'NO_SHEET', statusLabel: 'Chưa khởi tạo', isLocked: false, isCompleted: false },
          progress: { currentStageIndex: 1, totalStages: 4, isReturned: false },
          scores: { studentScore: 0, classCommitteeScore: 0, advisorScore: 0, finalScore: 0 },
          summary: { selectedCriteriaCount: 0 },
          stages: []
        }
      };
    }

    const progress = await this.getScoringProgress(userId, userId, undefined, activeSemester.id);
    const deadline = this.formatDashboardDeadlineInfo(activeSemester);

    return {
      semester: {
        id: activeSemester.id,
        name: activeSemester.name,
        academicYear: activeSemester.academic_year
      },
      deadline,
      sheet: progress.sheetId
        ? {
            sheetId: progress.sheetId,
            status: progress.statusInfo.dbStatus,
            studentScore: progress.scores.studentScore,
            selectedCriteriaCount: progress.summary?.selectedCriteriaCount ?? 0
          }
        : null,
      progress
    };
  }

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
    criteriaId = Number(criteriaId);
    score = Number(score);
    if (isNaN(criteriaId)) throw new BadRequestException('ID tiêu chí không hợp lệ!');
    if (isNaN(score)) throw new BadRequestException('Điểm không hợp lệ!');

    let targetSemesterId = semesterId;
    if (!targetSemesterId) {
      const activeSemester = await this.resolveCurrentScoringSemester();
      if (!activeSemester) throw new BadRequestException('Không tìm thấy học kỳ đang hoạt động!');
      targetSemesterId = activeSemester.id;
    }

    // 5a-0. Xác thực quyền thực tế của người thao tác (Fix IDOR)
    await this.verifyActorRole(actorId, studentId, role, targetSemesterId);

    // 5a. Validate (bao gồm kiểm tra quyền role và security checks)
    await this.validateBeforeScore(formId, criteriaId, score, role, studentId, targetSemesterId, proofUrl);

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
    const savedScore = await prisma.$transaction(async (tx) => {
      const dbScore = await tx.score_details.upsert({
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
      await tx.score_entries.upsert({
        where: {
          score_detail_id_scorer_role: {
            score_detail_id: dbScore.id,
            scorer_role: scorerRole,
          },
        },
        update: { score, scored_at: new Date() },
        create: {
          id: randomUUID(),
          score_detail_id: dbScore.id,
          scorer_role: scorerRole,
          score,
        },
      });

      // ✅ enforce mutual exclusivity (Check 2 lần tránh gian lận)
      await this.enforceMutualExclusivity(tx, scoreRecord.id, criteriaId, scorerRole);

      // ✅ Ghi log điều chỉnh điểm (nếu điểm cũ khác điểm mới)
      if (oldScore !== null && oldScore !== score) {
        await this.logScoreAdjustment(dbScore.id, actorId, oldScore, score, `Chấm điểm bởi ${role}`, tx);
      }

      // ✅ Ghi audit log
      await this.logCriticalAudit(actorId, 'SCORE_CRITERIA', 'score_details', dbScore.id,
        { criteria_id: criteriaId, old_score: oldScore },
        { criteria_id: criteriaId, new_score: score, role },
        tx
      );

      return dbScore;
    });

    return {
      message: `Lưu điểm thành công (${role})`,
      data: savedScore,
    };
  }

  // =============================================
  // XÓA ĐIỂM KHI USER RESET (CLICK BUTTON X)
  // =============================================
  async deleteCriteriaScore(
    formId: string,
    criteriaId: number,
    role: string,
    studentId: string,
    actorId: string,
    semesterId?: string,
  ) {
    criteriaId = Number(criteriaId);
    if (isNaN(criteriaId)) throw new BadRequestException('ID tiêu chí không hợp lệ!');

    let targetSemesterId = semesterId;
    if (!targetSemesterId) {
      const activeSemester = await this.resolveCurrentScoringSemester();
      if (!activeSemester) throw new BadRequestException('Không tìm thấy học kỳ đang hoạt động!');
      targetSemesterId = activeSemester.id;
    }

    await this.verifyActorRole(actorId, studentId, role, targetSemesterId);
    
    // ✅ PONYTAIL: Gộp 2 truy vấn độc lập
    const [scoreRecord, semester] = await Promise.all([
      this.getOrCreateDraftSheet(studentId, targetSemesterId),
      this.getSemesterWithDeadlines(targetSemesterId)
    ]);

    if (semester) {
      this.checkDeadline(role, semester);
    }
    
    const existingScoreDetail = await prisma.score_details.findUnique({
      where: { scoring_sheet_id_criteria_id: { scoring_sheet_id: scoreRecord.id, criteria_id: criteriaId } },
      include: { 
        score_entries: { where: { scorer_role: role as any } },
        criteria: true
      },
    });
    
    const entry = existingScoreDetail?.score_entries?.[0];
    if (!entry) {
      return { message: 'Không tìm thấy điểm để xóa', success: true };
    }
    
    await prisma.$transaction(async (tx) => {
      await tx.score_entries.delete({
        where: { id: entry.id }
      });
      
      await this.logScoreAdjustment(existingScoreDetail.id, actorId, Number(entry.score), 0, `Xóa điểm bởi ${role}`, tx);
      await this.logCriticalAudit(actorId, 'DELETE_CRITERIA_SCORE', 'score_details', existingScoreDetail.id,
        {
          scoring_sheet_id: scoreRecord.id,
          score_detail_id: existingScoreDetail.id,
          score_entry_id: entry.id,
          criterion_id: criteriaId,
          criterion_code: existingScoreDetail.criteria.code,
          criterion_name: existingScoreDetail.criteria.content,
          old_score: entry.score != null ? Number(entry.score) : null,
          actor_role: role,
        },
        {
          scoring_sheet_id: scoreRecord.id,
          score_detail_id: existingScoreDetail.id,
          score_entry_id: entry.id,
          criterion_id: criteriaId,
          criterion_code: existingScoreDetail.criteria.code,
          criterion_name: existingScoreDetail.criteria.content,
          new_score: 0,
          actor_role: role,
          deleted: true,
        },
        tx
      );
    });
    
    return { message: `Xóa điểm thành công (${role})`, success: true };
  }

  async validateFormForSubmission(formId: string, actorId: string, role: string) {
    const form = await prisma.scoring_sheets.findUnique({
      where: { id: formId },
      include: {
        semester_enrollments: {
          include: { semesters: true }
        },
        score_details: {
          include: {
            criteria: {
              include: { criteria_categories: true }
            },
            score_entries: true
          }
        }
      }
    });

    if (!form || !form.semester_enrollments) {
      throw new BadRequestException('Không tìm thấy phiếu điểm hợp lệ.');
    }

    const studentId = form.semester_enrollments.user_id;
    const targetSemesterId = form.semester_enrollments.semester_id;
    const semester = form.semester_enrollments.semesters;

    // 1. Xác thực quyền
    await this.verifyActorRole(actorId, studentId, role, targetSemesterId);

    // 2. Kiểm tra hạn chót
    if (semester) {
      this.checkDeadline(role, semester);
    }

    // 3. Kiểm tra trạng thái
    const transition = STATE_TRANSITIONS[role];
    if (!transition) {
      throw new BadRequestException(`Vai trò "${role}" không hợp lệ. Chỉ chấp nhận: STUDENT, CLASS_COMMITTEE, ADVISOR`);
    }

    const isAllowed = Array.isArray(transition.requiredStatus)
      ? transition.requiredStatus.includes(form.status)
      : form.status === transition.requiredStatus;

    if (!isAllowed) {
      throw new BadRequestException(transition.errorMessage);
    }

    const activeVersion = await prisma.criteria_versions.findFirst({
      where: { semester_id: targetSemesterId, is_active: 1 },
      orderBy: { created_at: 'desc' },
    });

    // 4. Validate từng tiêu chí (chỉ validate các tiêu chí có điểm != 0 do role hiện tại chấm)
    const parentMap = new Map<number, number[]>();
    const errors: SubmissionValidationError[] = [];
    
    for (const detail of form.score_details) {
      const criteria = detail.criteria;
      if (!criteria) continue;

      const entry = detail.score_entries.find(e => e.scorer_role === role);
      const score = entry ? Number(entry.score) : 0;

      if (score !== 0) {
        if (criteria.require_evidence === 1 && (!detail.proof_url || detail.proof_url.trim() === '')) {
          errors.push({
            criterionId: criteria.id,
            code: 'EVIDENCE_REQUIRED',
            message: `Tiêu chí "${criteria.code}" bắt buộc phải có link minh chứng!`,
          });
        }
        
        if (!criteria.is_active) {
          errors.push({
            criterionId: criteria.id,
            code: 'CRITERION_INACTIVE',
            message: `Tiêu chí "${criteria.code}" đã bị vô hiệu hóa!`,
          });
        }

        if (activeVersion && criteria.criteria_categories?.criteria_version_id !== activeVersion.id) {
          errors.push({
            criterionId: criteria.id,
            code: 'CRITERION_VERSION_MISMATCH',
            message: `Tiêu chí "${criteria.code}" không thuộc học kỳ hiện tại!`,
          });
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
        
        if (isQuantityBased) {
          const multiplier = QUANTITY_MULTIPLIERS[criteria.code];
          const absMultiplier = Math.abs(multiplier);
          const inputQuantity = Math.abs(score) / absMultiplier;
          const isDeduction = criteria.score_type === 'DEDUCTION' || criteria.point < 0;
          const maxQuantity = isDeduction ? 40 : 30;
          
          if (inputQuantity > maxQuantity) {
            errors.push({
              criterionId: criteria.id,
              code: 'QUANTITY_EXCEEDED',
              message: `Số lượng không được vượt quá ${maxQuantity} lần (tiêu chí "${criteria.code}")`,
            });
          }
        } else if (criteria.score_type === 'DEDUCTION' || criteria.point < 0) {
          if (score < criteria.point) {
            errors.push({
              criterionId: criteria.id,
              code: 'SCORE_OUT_OF_RANGE',
              message: `Điểm không được thấp hơn ${criteria.point} (tiêu chí "${criteria.code}")`,
            });
          }
          if (score > 0) {
            errors.push({
              criterionId: criteria.id,
              code: 'INVALID_SCORE_DIRECTION',
              message: `Điểm không được vượt quá 0 (tiêu chí "${criteria.code}")`,
            });
          }
        } else {
          if (score < 0) {
            errors.push({
              criterionId: criteria.id,
              code: 'INVALID_SCORE_DIRECTION',
              message: `Điểm không được thấp hơn 0 (tiêu chí "${criteria.code}")`,
            });
          }
          if (criteria.point > 0 && score > criteria.point) {
            errors.push({
              criterionId: criteria.id,
              code: 'SCORE_OUT_OF_RANGE',
              message: `Điểm không được vượt quá ${criteria.point} (tiêu chí "${criteria.code}")`,
            });
          }
        }

        if (criteria.parent_id) {
          if (!parentMap.has(criteria.parent_id)) parentMap.set(criteria.parent_id, []);
          parentMap.get(criteria.parent_id)!.push(criteria.id);
        }
      }
    }

    if (parentMap.size > 0) {
      const parentIds = Array.from(parentMap.keys());
      const parents = await prisma.criteria.findMany({
        where: { id: { in: parentIds } }
      });
      for (const parent of parents) {
        if (parent.score_type === 'OPTIONS' || (parent.score_type as string) === 'RADIO') {
           const scoredChildren = parentMap.get(parent.id) || [];
           if (scoredChildren.length > 1) {
             errors.push({
               criterionId: parent.id,
               code: 'MUTUALLY_EXCLUSIVE_OPTIONS',
               message: `Mục "${parent.code}" chỉ cho phép chọn 1 tiêu chí, nhưng đang có nhiều hơn 1 tiêu chí có điểm.`,
             });
           }
        }
      }
    }

    return { form, transition, studentId, errors };
  }

  // =============================================
  // 6. ✅ CHUYỂN TRẠNG THÁI PHIẾU (State Machine)
  //    Gộp từ cả 2 phiên bản: NestJS exceptions + Role-based transitions
  //    Frontend gửi: POST /scoring/:formId/submit  { role: 'STUDENT' }
  // =============================================
  async approveSingleFormInternal(formId: string, role: string, actorId: string, _semesterId?: string) {
    const { form, transition, studentId, errors } = await this.validateFormForSubmission(formId, actorId, role);

    if (errors && errors.length > 0) {
      throw new BadRequestException({
        message: 'Phiếu chưa hợp lệ.',
        errors: errors,
      });
    }

    const updateData: Record<string, any> = {
      status: transition.nextStatus,
      updated_at: new Date(),
      [transition.timestampField]: new Date(),
      rejection_reason: null,
    };

    const updated = await prisma.$transaction(async (tx) => {
      const up = await tx.scoring_sheets.updateMany({
        where: { 
          id: form.id,
          status: form.status
        },
        data: updateData,
      });

      if (up.count === 0) {
        throw new BadRequestException('STALE_STATUS');
      }

      await this.logCriticalAudit(actorId, 'SUBMIT_FORM', 'scoring_sheets', form.id,
        { status: form.status },
        { status: transition.nextStatus, role },
        tx
      );

      return up;
    });

    const warnings: any[] = [];
    try {
      if (role === 'STUDENT') {
        const sheetWithEnrollment = await prisma.scoring_sheets.findUnique({
          where: { id: form.id },
          select: { semester_enrollments: { select: { class_id: true, users: { select: { full_name: true } } } } },
        });
        const enrollInfo = sheetWithEnrollment?.semester_enrollments;
        if (enrollInfo) {
          const classMonitorRoles = await prisma.user_roles.findMany({
            where: { entity_id: enrollInfo.class_id, is_active: 1, roles: { code: 'MONITOR' } },
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
                data: { resourceType: 'SCORING', scoringSheetId: form.id, studentId },
              })),
            });
          }
        }
      } else if (role === 'CLASS_COMMITTEE') {
        const sheetWithEnrollment = await prisma.scoring_sheets.findUnique({
          where: { id: form.id },
          select: { semester_enrollments: { select: { class_id: true, user_id: true, users: { select: { full_name: true } } } } },
        });
        const enrollInfo = sheetWithEnrollment?.semester_enrollments;
        if (enrollInfo) {
          await prisma.notifications.create({
            data: {
              id: randomUUID(),
              user_id: enrollInfo.user_id,
              type: 'SCORE_REVIEWED',
              title: 'Phiếu rèn luyện đã được Ban cán sự duyệt',
              content: 'Phiếu tự đánh giá của bạn đã được Ban cán sự lớp duyệt và chuyển cho Cố vấn học tập.',
              is_read: 0,
              data: { resourceType: 'SCORING', scoringSheetId: form.id, studentId: enrollInfo.user_id },
            },
          });
          const advisorRoles = await prisma.user_roles.findMany({
            where: { entity_id: enrollInfo.class_id, is_active: 1, roles: { code: 'ADVISOR' } },
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
                data: { resourceType: 'SCORING', scoringSheetId: form.id, studentId: enrollInfo.user_id },
              })),
            });
          }
        }
      } else if (role === 'ADVISOR') {
        await prisma.notifications.create({
          data: {
            id: randomUUID(),
            user_id: studentId,
            type: 'SCORE_APPROVED',
            title: 'Phiếu rèn luyện đã được phê duyệt',
            content: 'Phiếu tự đánh giá của bạn đã được Cố vấn học tập phê duyệt và chốt sổ.',
            is_read: 0,
            data: { resourceType: 'SCORING', scoringSheetId: form.id, studentId },
          },
        });
      }
    } catch (err) {
      console.warn('Lỗi khi gửi thông báo nội bộ:', err);
      warnings.push({ code: 'NOTIFICATION_FAILED', message: 'Phiếu đã được xử lý nhưng chưa gửi được thông báo.' });
    }

    return { form, updated, transition, warnings };
  }

  async submitForm(formId: string, role: string, _inputStudentId: string, actorId: string, semesterId?: string) {
    const { updated } = await this.approveSingleFormInternal(formId, role, actorId, semesterId);
    return {
      message: this.getSuccessMessage(role),
      data: updated,
    };
  }

  // =============================================
  // 6.1 ✅ TRẢ LẠI PHIẾU (Chuyển sang REJECTED)
  // =============================================
  async rejectSingleFormInternal(formId: string, role: string, actorId: string, reason?: string) {
    if (!reason || reason.trim() === '') {
      throw new BadRequestException('Vui lòng nhập lý do trả lại phiếu.');
    }
    const cleanReason = reason.trim();
    if (cleanReason.length < 5 || cleanReason.length > 500) {
      throw new BadRequestException('Lý do trả lại phải từ 5 đến 500 ký tự.');
    }

    const form = await prisma.scoring_sheets.findFirst({
      where: {
        id: formId
      },
      include: {
        semester_enrollments: true
      }
    });

    if (!form) {
      throw new BadRequestException('Không tìm thấy phiếu điểm của sinh viên này!');
    }

    // Xác thực quyền thực tế của người thao tác (Fix IDOR)
    await this.verifyActorRole(actorId, form.semester_enrollments.user_id, role, form.semester_enrollments.semester_id);

    if (role !== 'CLASS_COMMITTEE' && role !== 'ADVISOR') {
      throw new BadRequestException('Chỉ Ban cán sự và Cố vấn học tập mới có quyền trả lại phiếu!');
    }

    if (role === 'CLASS_COMMITTEE' && !['STUDENT_SUBMITTED', 'CLASS_REVIEWING'].includes(form.status)) {
      throw new BadRequestException('Ban cán sự chỉ được trả lại phiếu khi sinh viên đã nộp.');
    }
    if (role === 'ADVISOR' && !['STUDENT_SUBMITTED', 'CLASS_REVIEWING', 'CLASS_REVIEWED', 'ADVISOR_REVIEWING', 'ADVISOR_APPROVED'].includes(form.status)) {
      throw new BadRequestException('Cố vấn chỉ được trả lại phiếu khi phiếu đã được xét duyệt.');
    }

    const newStatus = role === 'CLASS_COMMITTEE' ? 'CLASS_REJECTED' : 'ADVISOR_REJECTED';

    await prisma.$transaction(async (tx) => {
      const up = await tx.scoring_sheets.updateMany({
        where: { id: form.id, status: form.status },
        data: {
          status: newStatus as any,
          rejection_reason: cleanReason,
          updated_at: new Date(),
        }
      });
      
      if (up.count === 0) {
        throw new BadRequestException('STALE_STATUS');
      }

      await this.logCriticalAudit(actorId, 'REJECT_FORM', 'scoring_sheets', form.id,
        { status: form.status },
        { status: newStatus, role, reason: cleanReason },
        tx
      );
    });

    const warnings: any[] = [];
    try {
      const rejecterLabel = role === 'CLASS_COMMITTEE' ? 'Ban cán sự lớp' : 'Cố vấn học tập';
      await prisma.notifications.create({
        data: {
          id: randomUUID(),
          user_id: form.semester_enrollments.user_id,
          type: 'SCORE_REJECTED',
          title: 'Phiếu rèn luyện đã bị trả lại',
          content: `Phiếu tự đánh giá của bạn đã bị ${rejecterLabel} trả lại với lý do: "${cleanReason}". Vui lòng xem lại và nộp lại.`,
          is_read: 0,
          data: { resourceType: 'SCORING', scoringSheetId: form.id, studentId: form.semester_enrollments.user_id },
        },
      });
    } catch (notifErr) {
      console.warn('Lỗi khi gửi thông báo trả lại:', notifErr);
      warnings.push({ code: 'NOTIFICATION_FAILED', message: 'Phiếu đã được trả lại nhưng chưa gửi được thông báo.' });
    }

    return { form, warnings };
  }

  async rejectForm(formId: string, role: string, _studentId: string, actorId: string, _semesterId?: string, reason?: string) {
    await this.rejectSingleFormInternal(formId, role, actorId, reason);
    return {
      message: 'Đã trả lại phiếu thành công! Sinh viên có thể vào xem lý do và sửa điểm.',
      data: null,
    };
  }

  // =============================================
  private computeTotalsPure(
    details: any[],
    categories: { id: string, max_score: number }[],
    allCriteria: any[]
  ) {
    const categoryMaxMap = new Map<string, number>();
    for (const cat of categories) {
      categoryMaxMap.set(cat.id, cat.max_score);
    }

    const studentScoreMap = new Map<number, number>();
    const classScoreMap = new Map<number, number>();
    const advisorScoreMap = new Map<number, number>();

    for (const d of details) {
      const entries = d.score_entries || [];
      const sEntry = entries.find((e: any) => e.scorer_role === 'STUDENT');
      const cEntry = entries.find((e: any) => e.scorer_role === 'CLASS_COMMITTEE');
      const aEntry = entries.find((e: any) => e.scorer_role === 'ADVISOR');

      const sScore = sEntry !== undefined ? Number(sEntry.score) : 0;
      const cScore = cEntry !== undefined ? Number(cEntry.score) : sScore;
      const aScore = aEntry !== undefined ? Number(aEntry.score) : cScore;

      studentScoreMap.set(d.criteria_id, sScore);
      classScoreMap.set(d.criteria_id, cScore);
      advisorScoreMap.set(d.criteria_id, aScore);
    }

    const criteriaIdsSet = new Set(allCriteria.map(c => c.id));
    const isRootItem = (c: any) => !c.parent_id || !criteriaIdsSet.has(c.parent_id);

    const calculateTreeScore = (
      itemId: number,
      scoreMap: Map<number, number>,
      visited: Set<number>
    ): number => {
      if (visited.has(itemId)) return 0;
      visited.add(itemId);
      
      const item = allCriteria.find((c) => c.id === itemId);
      if (!item) return 0;
      
      if (item.score_type === 'FIXED') return item.point;
      
      const children = allCriteria.filter((c) => c.parent_id === itemId);
      
      if (children.length > 0) {
        let sum = 0;
        for (const child of children) {
          sum += calculateTreeScore(child.id, scoreMap, visited);
        }
        
        if (item.point > 0) return Math.min(sum, item.point);
        if (item.point < 0) return Math.min(0, Math.max(sum, item.point));
        return sum;
      }
      
      return scoreMap.get(itemId) ?? 0;
    };

    const byCategoryStudent = new Map<string, number>();
    const byCategoryClass = new Map<string, number>();
    const byCategoryAdvisor = new Map<string, number>();

    const rootCriteria = allCriteria.filter(isRootItem);

    for (const root of rootCriteria) {
      const catId = root.category_id;
      
      const sScore = calculateTreeScore(root.id, studentScoreMap, new Set());
      byCategoryStudent.set(catId, (byCategoryStudent.get(catId) || 0) + sScore);
      
      const cScore = calculateTreeScore(root.id, classScoreMap, new Set());
      byCategoryClass.set(catId, (byCategoryClass.get(catId) || 0) + cScore);
      
      const aScore = calculateTreeScore(root.id, advisorScoreMap, new Set());
      byCategoryAdvisor.set(catId, (byCategoryAdvisor.get(catId) || 0) + aScore);
    }

    let studentTotal = 0;
    let classTotal = 0;
    let advisorTotal = 0;

    for (const [catId, maxScore] of categoryMaxMap) {
      const rawStudent = byCategoryStudent.get(catId) || 0;
      const rawClass = byCategoryClass.get(catId) || 0;
      const rawAdvisor = byCategoryAdvisor.get(catId) || 0;

      studentTotal += Math.min(Math.max(0, rawStudent), maxScore);
      classTotal += Math.min(Math.max(0, rawClass), maxScore);
      advisorTotal += Math.min(Math.max(0, rawAdvisor), maxScore);
    }

    studentTotal = Math.round(Math.min(100, Math.max(0, studentTotal)) * 10) / 10;
    classTotal = Math.round(Math.min(100, Math.max(0, classTotal)) * 10) / 10;
    advisorTotal = Math.round(Math.min(100, Math.max(0, advisorTotal)) * 10) / 10;

    return { studentTotal, classTotal, advisorTotal };
  }

  // =============================================
  // 7. ✅ TÍNH TỔNG ĐIỂM TỰ ĐỘNG
  //    ✅ FIX: Áp trần điểm theo danh mục (category max_score)
  //    Tránh tổng điểm vượt quá giới hạn khi gọi API trực tiếp
  // =============================================
  private async calculateTotals(formId: string) {
    // ✅ PONYTAIL: Gộp truy vấn details và categories
    const [details, categories] = await Promise.all([
      prisma.score_details.findMany({
        where: { scoring_sheet_id: formId },
        select: {
          criteria_id: true,
          criteria: { select: { category_id: true } },
          score_entries: { select: { scorer_role: true, score: true } },
        },
      }),
      prisma.criteria_categories.findMany({
        select: { id: true, max_score: true },
      })
    ]);

    const catIds = new Set<string>();
    for (const d of details) {
      if (d.criteria?.category_id) catIds.add(d.criteria.category_id);
    }

    const allCriteria = await prisma.criteria.findMany({
      where: { category_id: { in: Array.from(catIds) }, is_active: 1 },
    });

    return this.computeTotalsPure(details, categories, allCriteria);
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