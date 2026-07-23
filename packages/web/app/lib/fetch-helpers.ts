import { AssignedClass, StudentListContext } from './scoring-types';

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
    let json: any = null;
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
      if (json?.code === 'CLASS_CONTEXT_REQUIRED') {
        return {
          type: 'class-context-required',
          message: json.message || 'Yêu cầu chọn lớp học',
          classes: json.classes || [],
        };
      }

      if (json?.code === 'CLASS_SCOPE_FORBIDDEN' || res.status === 403) {
        return {
          type: 'forbidden',
          message: json?.message || 'Tài khoản chưa được phân công quản lý lớp này.',
        };
      }

      return {
        type: 'error',
        message: json?.message || `Lỗi máy chủ (${res.status})`,
      };
    }

    // Success case (HTTP 20x)
    if (!json?.data || !json?.context) {
       return { type: 'error', message: 'Dữ liệu trả về không đúng định dạng.' };
    }

    return {
      type: 'success',
      data: json.data,
      context: json.context,
    };
  } catch (error: any) {
    if (error.name === 'AbortError') {
      return { type: 'error', message: 'Yêu cầu bị hủy.' };
    }
    return {
      type: 'error',
      message: error.message || 'Lỗi mạng hoặc không thể kết nối đến máy chủ.',
    };
  }
}
