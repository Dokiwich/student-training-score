// Định nghĩa các Hành động (Actions) có thể bấm trên giao diện
export type WorkflowAction = 
  | 'SUBMIT' 
  | 'START_CLASS_REVIEW' | 'APPROVE_CLASS'
  | 'START_ADVISOR_REVIEW' | 'APPROVE_ADVISOR'
  | 'START_SCHOOL_REVIEW' | 'APPROVE_SCHOOL'
  | 'APPEAL' | 'RESOLVE_APPEAL'
  | 'RESET_FORM'; // Hành động xóa và làm mới hoàn toàn

// CỖ MÁY TRẠNG THÁI: [Trạng thái hiện tại] -> { [Hành động]: [Trạng thái tiếp theo] }
// ✅ Hiện tại chức năng Trả lại đã được thay bằng Xóa/Reset (không còn trạng thái trung gian REJECTED)
export const WORKFLOW_RULES: Record<string, Partial<Record<WorkflowAction, string>>> = {
  DRAFT: {
    SUBMIT: 'STUDENT_SUBMITTED',
  },
  STUDENT_SUBMITTED: {
    START_CLASS_REVIEW: 'CLASS_REVIEWING',
  },
  CLASS_REVIEWING: {
    APPROVE_CLASS: 'CLASS_REVIEWED',
  },
  CLASS_REVIEWED: {
    START_ADVISOR_REVIEW: 'ADVISOR_REVIEWING',
  },
  ADVISOR_REVIEWING: {
    APPROVE_ADVISOR: 'ADVISOR_APPROVED',
  },
  ADVISOR_APPROVED: {
    START_SCHOOL_REVIEW: 'SCHOOL_REVIEWING',
  },
  SCHOOL_REVIEWING: {
    APPROVE_SCHOOL: 'FINALIZED',
  },
  FINALIZED: {
    APPEAL: 'APPEALING',
  },
  APPEALING: {
    RESOLVE_APPEAL: 'FINALIZED',
  }
};