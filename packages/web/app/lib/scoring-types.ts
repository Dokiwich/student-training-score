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
