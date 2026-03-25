import { Controller, Post, Get, Param, Body } from '@nestjs/common';
import { ScoringService } from './scoring.service';
import { ZodValidationPipe } from '../../pipes/zod-validation.pipe';
import { SubmitScoreSchema, SubmitScoreType } from '@student-score/shared';

@Controller('scoring')
export class ScoringController {
  constructor(private readonly scoringService: ScoringService) { }

  @Get(':formId/scores')
  async getFormScores(@Param('formId') formId: string) {
    return this.scoringService.getScoresByFormId(formId);
  }

  @Get('criteria')
  async getAllCriteria() {
    return this.scoringService.getAllCriteria();
  }

  @Post(':formId/submit-criteria')
  async submitCriteria(
    @Param('formId') formId: string,
    @Body('criteriaId') criteriaId: number,
    @Body('score') score: number,
    @Body('role') role: string,
    @Body('proofUrl') proofUrl?: string
  ) {
    const activeRole = role || 'STUDENT';
    return this.scoringService.submitCriteria(formId, criteriaId, score, activeRole, proofUrl);
  }

  @Post(':formId/submit')
  async submitForm(
    @Param('formId') formId: string,
    @Body('role') role: string
  ) {
    const activeRole = role || 'STUDENT';
    return this.scoringService.submitForm(formId, activeRole);
  }
}