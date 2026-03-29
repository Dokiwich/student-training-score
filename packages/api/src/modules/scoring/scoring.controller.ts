import { Controller, Post, Get, Param, Body, UseGuards, Req, Query } from '@nestjs/common';
import { ScoringService } from './scoring.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller('scoring')
@UseGuards(JwtAuthGuard)
export class ScoringController {
  constructor(private readonly scoringService: ScoringService) { }

  @Get('students')
  async getStudents(@Req() req: any) {
    const studentId = req.user?.studentId;
    return this.scoringService.getStudentListByUser(studentId);
  }

  @Get(':formId/scores')
  async getFormScores(@Param('formId') formId: string, @Query('studentId') studentId: string) {
    return this.scoringService.getScoresByFormId(formId, studentId);
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
    @Body('studentId') studentId: string,
    @Req() req: any,
    @Body('proofUrl') proofUrl?: string
  ) {
    const activeRole = req.user?.role || 'STUDENT';
    return this.scoringService.submitCriteria(formId, criteriaId, score, activeRole, studentId, proofUrl);
  }

  @Post(':formId/submit')
  async submitForm(
    @Param('formId') formId: string,
    @Body('studentId') studentId: string,
    @Req() req: any
  ) {
    const activeRole = req.user?.role || 'STUDENT';
    return this.scoringService.submitForm(formId, activeRole, studentId);
  }
}