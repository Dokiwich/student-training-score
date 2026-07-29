export type AssignedClass = {
  id: string;
  name: string;
};

export type StudentListContext = {
  semesterId: string;
  classIds: string[];
  selectedClassId: string | null;
  classes: AssignedClass[];
  reason?: 'NO_ENROLLMENTS_FOR_CURRENT_SEMESTER';
};

export type StudentListResponse<T> = {
  data: T[];
  context: StudentListContext;
};

export type AdvisorClassesResponse = {
  data: AssignedClass[];
  context: { semesterId: string };
};

export type ClassContextRequiredPayload = {
  statusCode: 400;
  code: 'CLASS_CONTEXT_REQUIRED';
  message: string;
  classes: AssignedClass[];
};

export type AmbiguousRoleContextPayload = {
  statusCode: 400;
  code: 'AMBIGUOUS_ROLE_CONTEXT';
  message: string;
};

export type ClassScopeForbiddenPayload = {
  statusCode: 403;
  code: 'CLASS_SCOPE_FORBIDDEN';
  message: string;
};

export type InvalidClassIdPayload = {
  statusCode: 400;
  code: 'INVALID_CLASS_ID';
  message: string;
};

export type ScoringStudentRow = {
  id: string;
  studentCode: string | null;
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
      status: 'ambiguous-role-context';
      message: string;
    }
  | {
      status: 'error';
      message: string;
    };

// ============================================
// TYPE GUARDS (Real Predicates)
// ============================================

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isAssignedClass(value: unknown): value is AssignedClass {
  return isRecord(value) && typeof value.id === 'string' && typeof value.name === 'string';
}

export function isStudentListContext(value: unknown): value is StudentListContext {
  if (!isRecord(value)) return false;
  
  const v = value;
  if (typeof v.semesterId !== 'string') return false;
  if (!Array.isArray(v.classIds) || !v.classIds.every(id => typeof id === 'string')) return false;
  if (v.selectedClassId !== null && typeof v.selectedClassId !== 'string') return false;
  if (!Array.isArray(v.classes) || !v.classes.every(isAssignedClass)) return false;
  if (v.reason !== undefined && v.reason !== 'NO_ENROLLMENTS_FOR_CURRENT_SEMESTER') return false;
  
  return true;
}

export function isStudentListResponse<T>(value: unknown, isItem?: (item: unknown) => item is T): value is StudentListResponse<T> {
  if (!isRecord(value)) return false;
  if (!Array.isArray(value.data)) return false;
  if (isItem && !value.data.every(isItem)) return false;
  if (!isStudentListContext(value.context)) return false;
  return true;
}

export function isAdvisorClassesResponse(value: unknown): value is AdvisorClassesResponse {
  if (!isRecord(value)) return false;
  if (!Array.isArray(value.data) || !value.data.every(isAssignedClass)) return false;
  if (!isRecord(value.context) || typeof value.context.semesterId !== 'string') return false;
  return true;
}

export function isClassContextRequiredPayload(value: unknown): value is ClassContextRequiredPayload {
  if (!isRecord(value)) return false;
  return value.statusCode === 400 && 
         value.code === 'CLASS_CONTEXT_REQUIRED' && 
         typeof value.message === 'string' &&
         Array.isArray(value.classes) &&
         value.classes.every(isAssignedClass);
}

export function isAmbiguousRoleContextPayload(value: unknown): value is AmbiguousRoleContextPayload {
  return isRecord(value) && value.statusCode === 400 && value.code === 'AMBIGUOUS_ROLE_CONTEXT' && typeof value.message === 'string';
}

export function isClassScopeForbiddenPayload(value: unknown): value is ClassScopeForbiddenPayload {
  return isRecord(value) && value.statusCode === 403 && value.code === 'CLASS_SCOPE_FORBIDDEN' && typeof value.message === 'string';
}

export function isInvalidClassIdPayload(value: unknown): value is InvalidClassIdPayload {
  return isRecord(value) && value.statusCode === 400 && value.code === 'INVALID_CLASS_ID' && typeof value.message === 'string';
}

export function isScoringStudentRow(value: unknown): value is ScoringStudentRow {
  if (!isRecord(value)) return false;
  
  if (typeof value.id !== 'string') return false;
  if (value.studentCode !== null && typeof value.studentCode !== 'string') return false;
  if (typeof value.name !== 'string') return false;
  if (value.email !== null && typeof value.email !== 'string') return false;
  if (value.className !== null && typeof value.className !== 'string') return false;
  if (value.formId !== null && typeof value.formId !== 'string') return false;
  if (typeof value.status !== 'string') return false;
  
  if (value.studentTotal !== null && typeof value.studentTotal !== 'number') return false;
  if (value.classTotal !== null && typeof value.classTotal !== 'number') return false;
  if (value.advisorTotal !== null && typeof value.advisorTotal !== 'number') return false;
  if (value.finalTotal !== null && typeof value.finalTotal !== 'number') return false;
  
  if (value.classification !== null && typeof value.classification !== 'string') return false;
  if (value.studentSubmittedAt !== null && typeof value.studentSubmittedAt !== 'string') return false;
  if (value.classReviewedAt !== null && typeof value.classReviewedAt !== 'string') return false;
  if (value.advisorApprovedAt !== null && typeof value.advisorApprovedAt !== 'string') return false;

  return true;
}
