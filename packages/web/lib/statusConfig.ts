export type StatusPresentation = {
  label: string;
  description?: string;
  tone: "neutral" | "info" | "warning" | "success" | "danger";
};

export const scoringSheetStatusConfig: Record<string, StatusPresentation> = {
  NO_SHEET: { label: "Chưa có phiếu", description: "Sinh viên chưa khởi tạo phiếu", tone: "neutral" },
  NOT_STARTED: { label: "Chưa nộp", description: "Phiếu chưa được gửi đi", tone: "neutral" },
  DRAFT: { label: "Đang thực hiện", description: "Đang lưu nháp", tone: "neutral" },
  STUDENT_SUBMITTED: { label: "SV đã nộp", description: "Chờ ban cán sự duyệt", tone: "info" },
  CLASS_REVIEWING: { label: "Chờ BCS duyệt", description: "Ban cán sự đang đánh giá", tone: "warning" },
  CLASS_REVIEWED: { label: "BCS đã duyệt", description: "Chờ cố vấn học tập duyệt", tone: "info" },
  CLASS_REJECTED: { label: "BCS trả lại", description: "Sinh viên cần cập nhật lại", tone: "danger" },
  ADVISOR_REVIEWING: { label: "Chờ CVHT duyệt", description: "Cố vấn học tập đang đánh giá", tone: "warning" },
  ADVISOR_APPROVED: { label: "CVHT đã duyệt", description: "Chờ Khoa xác nhận", tone: "info" },
  ADVISOR_REJECTED: { label: "CVHT trả lại", description: "BCS/Sinh viên cần cập nhật lại", tone: "danger" },
  SCHOOL_REVIEWING: { label: "Chờ Khoa duyệt", description: "Khoa đang kiểm tra", tone: "warning" },
  SCHOOL_APPROVED: { label: "Khoa đã duyệt", description: "Đã qua bước duyệt của Khoa", tone: "info" },
  SCHOOL_REJECTED: { label: "Khoa trả lại", description: "Yêu cầu đánh giá lại", tone: "danger" },
  FINALIZED: { label: "Đã hoàn tất", description: "Điểm đã được chốt", tone: "success" },
  APPEALING: { label: "Đang khiếu nại", description: "Đang xử lý khiếu nại", tone: "warning" },
};

export const appealStatusConfig: Record<string, StatusPresentation> = {
  PENDING: { label: "Chờ xử lý", description: "Đang chờ Khoa xem xét", tone: "warning" },
  DEPT_REVIEWED: { label: "Đã xem xét", description: "Khoa đã duyệt, chờ chốt", tone: "info" },
  ACCEPTED: { label: "Chấp thuận", description: "Khiếu nại thành công", tone: "success" },
  REJECTED: { label: "Từ chối", description: "Khiếu nại không hợp lệ", tone: "danger" },
};

export const semesterStatusConfig: Record<string, StatusPresentation> = {
  UPCOMING: { label: "Sắp diễn ra", tone: "neutral" },
  STUDENT_SCORING: { label: "Sinh viên tự đánh giá", tone: "info" },
  CLASS_REVIEWING: { label: "Ban cán sự đánh giá", tone: "warning" },
  ADVISOR_REVIEWING: { label: "CVHT đánh giá", tone: "warning" },
  SCHOOL_REVIEWING: { label: "Khoa đánh giá", tone: "warning" },
  FINALIZED: { label: "Đã tổng kết", tone: "success" },
  LOCKED: { label: "Đã khóa", tone: "danger" },
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
