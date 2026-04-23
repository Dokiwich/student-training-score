import { z } from 'zod';

// Định nghĩa khuôn mẫu (Schema) ép buộc dữ liệu phải tuân theo
export const SubmitScoreSchema = z.object({
  criteriaId: z.number({
    required_error: 'Mã tiêu chí không được để trống',
    invalid_type_error: 'Mã tiêu chí phải là số',
  }).int('Mã tiêu chí phải là số nguyên'),

  // Điểm số bắt buộc là số, từ 0 trở lên
  // Không giới hạn max ở đây — trần điểm do mục cha quy định (frontend tính)
  // DB column: Decimal(5,2) → max vật lý: 999.99
  studentScore: z.number({
    required_error: 'Bắt buộc phải nhập điểm',
    invalid_type_error: 'Điểm rèn luyện phải là một con số',
  })
  .min(0, 'Điểm rèn luyện không được là số âm'),
});

// Zod tự động dịch Schema trên thành Type cho TypeScript xài
export type SubmitScoreType = z.infer<typeof SubmitScoreSchema>;