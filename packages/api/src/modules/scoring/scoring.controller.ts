import { Controller, Post, Get, Param, Body } from '@nestjs/common';
import { ScoringService } from './scoring.service';
import { ZodValidationPipe } from '../../pipes/zod-validation.pipe';
import { SubmitScoreSchema, SubmitScoreType } from '@student-score/shared';

@Controller('scoring')
export class ScoringController {
  constructor(private readonly scoringService: ScoringService) { }

  @Post(':formId/submit-criteria')
  async submitCriteriaScore(
    @Param('formId') formId: string,
    @Body(new ZodValidationPipe(SubmitScoreSchema)) body: SubmitScoreType,
  ) {
    const result = await this.scoringService.saveStudentScore(
      formId,
      body.criteriaId,
      body.studentScore,
    );
    return result;
  }

  @Get(':formId/scores')
  async getFormScores(@Param('formId') formId: string) {
    return this.scoringService.getScoresByFormId(formId);
  }
}