import { AssignedClass, StudentListContext, isClassContextRequiredPayload, isClassScopeForbiddenPayload, isStudentListResponse } from './scoring-types';

export type FetchClassScopedStudentsResult<T> =
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
      type: 'forbidden';
      message: string;
    }
  | {
      type: 'error';
      message: string;
    };

export async function fetchClassScopedStudents<T>(
  endpoint: string,
  customJwt?: string
): Promise<FetchClassScopedStudentsResult<T>> {
  try {
    const options: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...(customJwt ? { Authorization: `Bearer ${customJwt}` } : {}),
      },
    };
    const res = await fetch(endpoint, options);
    
    // Attempt to parse JSON regardless of status, as our API should return JSON errors.
    let json: unknown = null;
    let text = '';
    try {
      text = await res.text();
      json = JSON.parse(text);
    } catch (e) {
      // If parsing fails (e.g. proxy returned HTML or empty body)
      if (!res.ok) {
        return { type: 'error', message: `Lỗi máy chủ (${res.status}): ${res.statusText}` };
      }
      return { type: 'error', message: 'Lỗi máy chủ: Phản hồi không hợp lệ.' };
    }

    if (!res.ok) {
      if (isClassContextRequiredPayload(json)) {
        return {
          type: 'class-context-required',
          message: json.message || 'Yêu cầu chọn lớp học',
          classes: json.classes || [],
        };
      }

      if (isClassScopeForbiddenPayload(json) || res.status === 403) {
        return {
          type: 'forbidden',
          message: isClassScopeForbiddenPayload(json) ? json.message : 'Tài khoản chưa được phân công quản lý lớp này.',
        };
      }

      const errorMsg = (typeof json === 'object' && json !== null && 'message' in json) ? (json as any).message : `Lỗi máy chủ (${res.status})`;
      return {
        type: 'error',
        message: errorMsg,
      };
    }

    // Success case (HTTP 20x)
    if (!isStudentListResponse(json)) {
       return { type: 'error', message: 'Dữ liệu trả về không đúng định dạng.' };
    }

    return {
      type: 'success',
      data: (json as any).data,
      context: (json as any).context,
    };
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'AbortError') {
      return { type: 'error', message: 'Yêu cầu bị hủy.' };
    }
    return {
      type: 'error',
      message: error instanceof Error ? error.message : 'Lỗi mạng hoặc không thể kết nối đến máy chủ.',
    };
  }
}
