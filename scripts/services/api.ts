// Trạm trung chuyển cấu hình sẵn đường dẫn tới Backend
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

export const apiClient = {
  post: async (endpoint: string, data: any) => {
    const response = await fetch(`${API_URL}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    
    // Nếu Backend ném lỗi (như lỗi Zod 400 hoặc 404), bắt lại và quăng ra
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Có lỗi xảy ra từ máy chủ');
    }
    
    return response.json();
  }
};