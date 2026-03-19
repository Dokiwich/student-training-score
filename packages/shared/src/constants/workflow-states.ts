// Định nghĩa các Hành động (Actions) có thể bấm trên giao diện
export type WorkflowAction = 
  | 'SUBMIT' 
  | 'START_CLASS_REVIEW' | 'APPROVE_CLASS' | 'REJECT_CLASS'
  | 'START_ADVISOR_REVIEW' | 'APPROVE_ADVISOR' | 'REJECT_ADVISOR'
  | 'START_SCHOOL_REVIEW' | 'APPROVE_SCHOOL' | 'REJECT_SCHOOL'
  | 'RESUBMIT' | 'APPEAL' | 'RESOLVE_APPEAL';

// CỖ MÁY TRẠNG THÁI: [Trạng thái hiện tại] -> { [Hành động]: [Trạng thái tiếp theo] }
export const WORKFLOW_RULES: Record<string, Partial<Record<WorkflowAction, string>>> = {
  DRAFT: {
    SUBMIT: 'STUDENT_SUBMITTED',
  },
  STUDENT_SUBMITTED: {
    START_CLASS_REVIEW: 'CLASS_REVIEWING',
  },
  CLASS_REVIEWING: {
    APPROVE_CLASS: 'CLASS_REVIEWED',
    REJECT_CLASS: 'CLASS_REJECTED', // Trả về cho sinh viên sửa
  },
  CLASS_REJECTED: {
    RESUBMIT: 'STUDENT_SUBMITTED', // Sinh viên sửa xong nộp lại
  },
  CLASS_REVIEWED: {
    START_ADVISOR_REVIEW: 'ADVISOR_REVIEWING',
  },
  ADVISOR_REVIEWING: {
    APPROVE_ADVISOR: 'ADVISOR_APPROVED',
    REJECT_ADVISOR: 'ADVISOR_REJECTED', // Cố vấn chê, trả về cho Lớp chấm lại
  },
  ADVISOR_REJECTED: {
    RESUBMIT: 'CLASS_REVIEWING', 
  },
  ADVISOR_APPROVED: {
    START_SCHOOL_REVIEW: 'SCHOOL_REVIEWING',
  },
  SCHOOL_REVIEWING: {
    APPROVE_SCHOOL: 'FINALIZED', // Chốt sổ!
    REJECT_SCHOOL: 'SCHOOL_REJECTED', 
  },
  SCHOOL_REJECTED: {
    RESUBMIT: 'ADVISOR_REVIEWING', // Trường chê, trả về cho Cố vấn
  },
  FINALIZED: {
    APPEAL: 'APPEALING', // Sinh viên khóc lóc đòi phúc khảo
  },
  APPEALING: {
    RESOLVE_APPEAL: 'FINALIZED', // Giải quyết xong, chốt lại lần cuối
  }
};