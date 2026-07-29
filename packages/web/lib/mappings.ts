export const scoringStatusConfig: Record<string, { label: string; tone: "default" | "info" | "warning" | "success" | "danger" }> = {
  NO_SHEET: {
    label: "Chưa có phiếu",
    tone: "default",
  },
  NOT_CREATED: {
    label: "Chưa nộp",
    tone: "default",
  },
  SUBMITTED: {
    label: "Đã nộp",
    tone: "info",
  },
  DRAFT: {
    label: "Đang thực hiện",
    tone: "info",
  },
  STUDENT_SUBMITTED: {
    label: "Đã nộp",
    tone: "info",
  },
  CLASS_REVIEWING: {
    label: "Chờ ban cán sự duyệt",
    tone: "warning",
  },
  CLASS_REVIEWED: {
    label: "BCS đã duyệt",
    tone: "info",
  },
  CLASS_REJECTED: {
    label: "BCS trả lại",
    tone: "danger",
  },
  ADVISOR_REVIEWING: {
    label: "Chờ cố vấn duyệt",
    tone: "warning",
  },
  ADVISOR_APPROVED: {
    label: "Cố vấn đã duyệt",
    tone: "info",
  },
  ADVISOR_REJECTED: {
    label: "Cố vấn trả lại",
    tone: "danger",
  },
  SCHOOL_REVIEWING: {
    label: "Chờ khoa xác nhận",
    tone: "warning",
  },
  SCHOOL_APPROVED: {
    label: "Khoa đã duyệt",
    tone: "info",
  },
  SCHOOL_REJECTED: {
    label: "Khoa trả lại",
    tone: "danger",
  },
  FINALIZED: {
    label: "Đã hoàn tất",
    tone: "success",
  },
  APPEALING: {
    label: "Đang khiếu nại",
    tone: "warning",
  },
};

export const appealStatusConfig: Record<string, { label: string; tone: "default" | "info" | "warning" | "success" | "danger" }> = {
  PENDING: {
    label: "Chờ xử lý",
    tone: "warning",
  },
  ACCEPTED: {
    label: "Được chấp thuận",
    tone: "success",
  },
  REJECTED: {
    label: "Bị từ chối",
    tone: "danger",
  },
  DEPT_REVIEWED: {
    label: "Khoa đã xét duyệt",
    tone: "info",
  },
};

export const roleLabelConfig: Record<string, string> = {
  STUDENT: "Sinh viên",
  CLASS_COMMITTEE: "Ban cán sự lớp",
  ADVISOR: "Cố vấn học tập",
  DEPARTMENT: "Quản lý khoa",
  SCHOOL_ADMIN: "Quản trị viên",
};

export const reviewActionConfig: Record<string, string> = {
  SUBMIT: "Nộp phiếu",
  APPROVE: "Chấp thuận",
  REJECT: "Trả lại",
  ADJUST_SCORE: "Điều chỉnh điểm",
  COMMENT: "Thêm bình luận",
  RESUBMIT: "Nộp lại",
  APPEAL: "Khiếu nại",
  FINALIZE: "Hoàn tất",
};
