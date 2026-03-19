import { z } from 'zod';

// Định nghĩa khuôn mẫu (Schema) ép buộc dữ liệu phải tuân theo
export const SubmitScoreSchema = z.object({
  criteriaId: z.number({
    required_error: 'Mã tiêu chí không được để trống',
    invalid_type_error: 'Mã tiêu chí phải là số',
  }).int('Mã tiêu chí phải là số nguyên'),

  // Điểm số bắt buộc là số, từ 0 đến tối đa 100 điểm
  // Chỉ cho phép tối đa 1 chữ số thập phân (khớp DB Decimal(5,1))
  studentScore: z.number({
    required_error: 'Bắt buộc phải nhập điểm',
    invalid_type_error: 'Điểm rèn luyện phải là một con số',
  })
  .min(0, 'Điểm rèn luyện không được là số âm')
  .max(100, 'Điểm rèn luyện không được vượt quá 100')
  .multipleOf(0.1, 'Điểm rèn luyện chỉ được có tối đa 1 chữ số thập phân'),
});

// Zod tự động dịch Schema trên thành Type cho TypeScript xài
export type SubmitScoreType = z.infer<typeof SubmitScoreSchema>;