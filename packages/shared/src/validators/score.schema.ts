import { z } from 'zod';


export const SubmitScoreSchema = z.object({
  criteriaId: z.number({
    required_error: 'Mã tiêu chí không được để trống',
    invalid_type_error: 'Mã tiêu chí phải là số',
  }).int('Mã tiêu chí phải là số nguyên'),

  studentScore: z.number({
    required_error: 'Bắt buộc phải nhập điểm',
    invalid_type_error: 'Điểm rèn luyện phải là một con số',
  })
    .min(0, 'Điểm rèn luyện không được là số âm'),
});
export type SubmitScoreType = z.infer<typeof SubmitScoreSchema>;