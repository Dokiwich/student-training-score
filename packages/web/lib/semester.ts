import { prisma } from '@student-score/database';

export const SEMESTER_SELECT = {
  id: true,
  code: true,
  name: true,
  academic_year: true,
  status: true,
  start_date: true,
  end_date: true,
  student_deadline: true,
  class_committee_deadline: true,
  advisor_deadline: true,
  school_deadline: true,
  semester_number: true,
} as const;

export function computeStatus(semester: {
  start_date: Date;
  end_date: Date;
  student_deadline: Date;
  class_committee_deadline: Date;
  advisor_deadline: Date;
  school_deadline: Date;
}): string {
  const now = new Date();
  if (now < new Date(semester.start_date)) return 'UPCOMING';
  if (now < new Date(semester.student_deadline)) return 'STUDENT_SCORING';
  if (now < new Date(semester.class_committee_deadline)) return 'CLASS_REVIEWING';
  if (now < new Date(semester.advisor_deadline)) return 'ADVISOR_REVIEWING';
  if (now < new Date(semester.school_deadline)) return 'SCHOOL_REVIEWING';
  if (now <= new Date(semester.end_date)) return 'FINALIZED';
  return 'LOCKED';
}

export async function getActiveSemester() {
  let semester = await prisma.semesters.findFirst({
    where: { is_active: 1 },
    orderBy: { start_date: 'desc' },
    select: SEMESTER_SELECT,
  });

  if (!semester) {
    semester = await prisma.semesters.findFirst({
      orderBy: { start_date: 'desc' },
      select: SEMESTER_SELECT,
    });
  }

  if (semester) {
    const computed = computeStatus(semester as any);
    if (computed !== semester.status) {
      semester = { ...semester, status: computed as any };
      // Async update to DB
      prisma.semesters.update({
        where: { id: semester.id },
        data: { status: computed as any },
      }).catch(console.error);
    }
  }

  return semester;
}

export interface DashboardDeadlineInfo {
  semester: {
    id: string;
    name: string;
    academicYear: string;
  } | null;
  currentPhase: string;
  currentPhaseLabel: string;
  studentSubmissionDeadline: Date | null;
  remainingTimeText: string;
  isOverdue: boolean;
  daysLeft: number;
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

export function formatDashboardDeadlineInfo(semester: any | null): DashboardDeadlineInfo {
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

export async function getStudentDashboardDeadlineInfo(): Promise<DashboardDeadlineInfo> {
  const semester = await getActiveSemester();
  return formatDashboardDeadlineInfo(semester);
}
