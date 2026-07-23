import { 
  AssignedClass, 
  StudentListContext, 
  isClassContextRequiredPayload, 
  isClassScopeForbiddenPayload,
  isAmbiguousRoleContextPayload,
  isStudentListResponse,
  isAdvisorClassesResponse,
  isRecord
} from './scoring-types';

export type ClassScopedFetchResult<T> =
  | {
      type: 'success';
      data: T[];
      context: StudentListContext;
    }
  | {
      type: 'class-context-required';
      message: string;
      classes: AssignedClass[];
    }
  | {
      type: 'ambiguous-role-context';
      message: string;
    }
  | {
      type: 'forbidden';
      message: string;
    }
  | {
      type: 'error';
      code:
        | 'NETWORK_ERROR'
        | 'REQUEST_ABORTED'
        | 'INVALID_RESPONSE'
        | 'SERVER_ERROR';
      message: string;
    };

export async function fetchClassScopedStudents<T>(
  endpoint: string,
  customJwt: string | undefined,
  isItem?: (item: unknown) => item is T
): Promise<ClassScopedFetchResult<T>> {
  try {
    const options: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...(customJwt ? { Authorization: `Bearer ${customJwt}` } : {}),
      },
    };
    const res = await fetch(endpoint, options);
    
    let text = '';
    let json: unknown = null;
    try {
      text = await res.text();
      if (!text) {
        return { type: 'error', code: 'INVALID_RESPONSE', message: 'Phản hồi từ máy chủ trống rỗng.' };
      }
      json = JSON.parse(text);
    } catch (e) {
      if (!res.ok) {
        return { type: 'error', code: 'SERVER_ERROR', message: `Lỗi máy chủ (${res.status}): ${res.statusText}` };
      }
      return { type: 'error', code: 'INVALID_RESPONSE', message: 'Lỗi máy chủ: Phản hồi không phải định dạng JSON hợp lệ.' };
    }

    if (!res.ok) {
      if (isClassContextRequiredPayload(json)) {
        return {
          type: 'class-context-required',
          message: json.message,
          classes: json.classes,
        };
      }
      if (isAmbiguousRoleContextPayload(json)) {
        return {
          type: 'ambiguous-role-context',
          message: json.message,
        };
      }
      if (isClassScopeForbiddenPayload(json) || res.status === 403) {
        return {
          type: 'forbidden',
          message: isClassScopeForbiddenPayload(json) ? json.message : 'Tài khoản chưa được phân công quản lý lớp này.',
        };
      }
      
      let errorMsg = `Lỗi máy chủ (${res.status})`;
      if (isRecord(json) && typeof json.message === 'string') {
        errorMsg = json.message;
      }
      return {
        type: 'error',
        code: 'SERVER_ERROR',
        message: errorMsg,
      };
    }

    if (!isStudentListResponse(json, isItem)) {
       return { type: 'error', code: 'INVALID_RESPONSE', message: 'Dữ liệu trả về không đúng định dạng mong đợi.' };
    }

    return {
      type: 'success',
      data: json.data,
      context: json.context,
    };
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'AbortError') {
      return { type: 'error', code: 'REQUEST_ABORTED', message: 'Yêu cầu bị hủy.' };
    }
    return {
      type: 'error',
      code: 'NETWORK_ERROR',
      message: error instanceof Error ? error.message : 'Lỗi mạng hoặc không thể kết nối đến máy chủ.',
    };
  }
}

export async function fetchAssignedClasses(
  endpoint: string,
  customJwt: string | undefined
): Promise<ClassScopedFetchResult<AssignedClass>> {
  try {
    const options: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...(customJwt ? { Authorization: `Bearer ${customJwt}` } : {}),
      },
    };
    const res = await fetch(endpoint, options);
    
    let text = '';
    let json: unknown = null;
    try {
      text = await res.text();
      if (!text) {
        return { type: 'error', code: 'INVALID_RESPONSE', message: 'Phản hồi từ máy chủ trống rỗng.' };
      }
      json = JSON.parse(text);
    } catch (e) {
      if (!res.ok) {
        return { type: 'error', code: 'SERVER_ERROR', message: `Lỗi máy chủ (${res.status}): ${res.statusText}` };
      }
      return { type: 'error', code: 'INVALID_RESPONSE', message: 'Lỗi máy chủ: Phản hồi JSON không hợp lệ.' };
    }

    if (!res.ok) {
      if (isClassScopeForbiddenPayload(json) || res.status === 403) {
        return {
          type: 'forbidden',
          message: isClassScopeForbiddenPayload(json) ? json.message : 'Tài khoản chưa được phân công quản lý lớp nào.',
        };
      }
      if (isAmbiguousRoleContextPayload(json)) {
        return {
          type: 'ambiguous-role-context',
          message: json.message,
        };
      }
      let errorMsg = `Lỗi máy chủ (${res.status})`;
      if (isRecord(json) && typeof json.message === 'string') {
        errorMsg = json.message;
      }
      return {
        type: 'error',
        code: 'SERVER_ERROR',
        message: errorMsg,
      };
    }

    if (!isAdvisorClassesResponse(json)) {
       return { type: 'error', code: 'INVALID_RESPONSE', message: 'Dữ liệu trả về không đúng định dạng.' };
    }

    return {
      type: 'success',
      data: json.data,
      context: {
        semesterId: json.context.semesterId,
        classIds: json.data.map(c => c.id),
        selectedClassId: null,
        classes: json.data
      },
    };
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'AbortError') {
      return { type: 'error', code: 'REQUEST_ABORTED', message: 'Yêu cầu bị hủy.' };
    }
    return {
      type: 'error',
      code: 'NETWORK_ERROR',
      message: error instanceof Error ? error.message : 'Lỗi kết nối.',
    };
  }
}
