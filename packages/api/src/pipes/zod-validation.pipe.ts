import { PipeTransform, ArgumentMetadata, BadRequestException } from '@nestjs/common';
import { ZodSchema } from 'zod';

export class ZodValidationPipe implements PipeTransform {
  constructor(private schema: ZodSchema) {}

  transform(value: unknown, metadata: ArgumentMetadata) {
    // Dùng safeParse để Zod không làm sập máy chủ khi gặp lỗi
    const result = this.schema.safeParse(value);
    
    if (!result.success) {
      // Nếu Zod bắt được lỗi, lấy ngay dòng thông báo tiếng Việt bạn đã viết để quăng ra
      const errorMessage = result.error.errors[0].message;
      throw new BadRequestException(errorMessage);
    }
    
    // Nếu dữ liệu ngon lành, trả lại để đi tiếp vào Controller
    return result.data;
  }
}