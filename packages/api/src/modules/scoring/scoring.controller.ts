import { Controller, Post, Get, Param, Body } from '@nestjs/common';
import { ScoringService } from './scoring.service';
import { ZodValidationPipe } from '../../pipes/zod-validation.pipe';
import { SubmitScoreSchema, SubmitScoreType } from '@student-score/shared';

@Controller('scoring')
export class ScoringController {
  constructor(private readonly scoringService: ScoringService) { }

  @Post(':formId/submit-criteria')
  async submitCriteria(
    @Param('formId') formId: string,
    @Body('criteriaId') criteriaId: number,
    @Body('studentScore') score: number,
    @Body('role') role: string // Tạm thời nhận role từ body để test
  ) {
    // Nếu Frontend không gửi role, mặc định coi như là Sinh viên tự chấm
    const activeRole = role || 'STUDENT';
    return this.scoringService.submitCriteria(formId, criteriaId, score, activeRole);
  }

  @Get(':formId/scores')
  async getFormScores(@Param('formId') formId: string) {
    return this.scoringService.getScoresByFormId(formId);
  }
  @Get('criteria')
  async getAllCriteria() {
    return this.scoringService.getAllCriteria();
  }
}