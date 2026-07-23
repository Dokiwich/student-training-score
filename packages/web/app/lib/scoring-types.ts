export type AssignedClass = {
  id: string;
  name: string;
};

export type ClassContextRequiredPayload = {
  statusCode: 400;
  code: 'CLASS_CONTEXT_REQUIRED';
  message: string;
  classes: AssignedClass[];
};

export type ClassScopeForbiddenPayload = {
  statusCode: 403;
  code: 'CLASS_SCOPE_FORBIDDEN';
  message: string;
};

export function isClassContextRequiredPayload(value: unknown): value is ClassContextRequiredPayload {
  return typeof value === 'object' && value !== null && (value as any).code === 'CLASS_CONTEXT_REQUIRED';
}

export function isClassScopeForbiddenPayload(value: unknown): value is ClassScopeForbiddenPayload {
  return typeof value === 'object' && value !== null && (value as any).code === 'CLASS_SCOPE_FORBIDDEN';
}

export function isStudentListResponse(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as any;
  return Array.isArray(v.data) && typeof v.context === 'object' && v.context !== null && Array.isArray(v.context.classIds) && Array.isArray(v.context.classes);
}

export type ScoringStudentRow = {
  id: string;
  studentCode: string;
  name: string;
  email: string | null;
  className: string | null;
  formId: string | null;
  status: string;
  studentTotal: number | null;
  classTotal: number | null;
  advisorTotal: number | null;
  finalTotal: number | null;
  classification: string | null;
  studentSubmittedAt: string | null;
  classReviewedAt: string | null;
  advisorApprovedAt: string | null;
};

export type StudentListContext = {
  semesterId: string;
  classIds: string[];
  selectedClassId: string | null;
  classes: AssignedClass[];
  reason?: 'NO_ENROLLMENTS_FOR_CURRENT_SEMESTER';
};

export type ClassDataState<T> =
  | { status: 'loading' }
  | {
      status: 'ready';
      data: T[];
      context: StudentListContext;
    }
  | {
      status: 'class-context-required';
      classes: AssignedClass[];
      message: string;
    }
  | {
      status: 'empty-enrollment';
      title?: string;
      message: string;
      context: StudentListContext;
    }
  | {
      status: 'forbidden';
      message: string;
    }
  | {
      status: 'error';
      message: string;
    };
