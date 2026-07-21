export interface NotificationData {
  resourceType?: string;
  scoringSheetId?: string;
  appealId?: string;
  studentId?: string;
  [key: string]: any;
}

export interface NotificationPayload {
  type: string;
  currentRole: string;
  data: NotificationData | null;
}

export function getNotificationTargetUrl(payload: NotificationPayload): string | null {
  const { type, currentRole, data } = payload;
  const studentId = data?.studentId;

  switch (type) {
    case 'SCORE_SUBMITTED':
      if (currentRole === 'CLASS_COMMITTEE') {
        return studentId ? `/class-president/${studentId}` : '/class-president/dashboard';
      }
      if (currentRole === 'ADVISOR') {
        return studentId ? `/advisor/${studentId}` : '/advisor/reviews';
      }
      break;

    case 'SCORE_REVIEWED':
      if (currentRole === 'STUDENT') {
        return '/student/scoring-progress';
      }
      if (currentRole === 'ADVISOR') {
        return studentId ? `/advisor/${studentId}` : '/advisor/reviews';
      }
      break;

    case 'SCORE_APPROVED':
    case 'SCORE_REJECTED':
    case 'SCORE_FINALIZED':
      if (currentRole === 'STUDENT') {
        return '/student/history';
      }
      break;

    case 'APPEAL_SUBMITTED':
      if (currentRole === 'DEPARTMENT') {
        return '/department/appeals';
      }
      if (currentRole === 'SCHOOL_ADMIN') {
        return '/admin/appeals';
      }
      break;

    case 'APPEAL_RESOLVED':
      if (currentRole === 'STUDENT') {
        return '/student/appeals';
      }
      break;
  }

  // Fallback to null if no matching route is found
  return null;
}
