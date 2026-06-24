import { Controller, Post, Get, Param, Body, UseGuards, Req, Query } from '@nestjs/common';
import { ScoringService } from './scoring.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller('scoring')
@UseGuards(JwtAuthGuard)
export class ScoringController {
  constructor(private readonly scoringService: ScoringService) { }

  @Get('students')
  async getStudents(@Req() req: any) {
    const userId = req.user?.id;
    return this.scoringService.getStudentListByUser(userId);
  }

  @Get('criteria')
  async getAllCriteria() {
    return this.scoringService.getAllCriteria();
  }

  @Get(':formId/scores')
  async getFormScores(@Param('formId') formId: string, @Query('studentId') studentId: string, @Query('semesterId') semesterId?: string) {
    return this.scoringService.getScoresByFormId(formId, studentId, semesterId);
  }

  @Post(':formId/submit-criteria')
  async submitCriteria(
    @Param('formId') formId: string,
    @Body('criteriaId') criteriaId: number,
    @Body('score') score: number,
    @Body('studentId') studentId: string,
    @Req() req: any,
    @Body('proofUrl') proofUrl?: string,
    @Body('role') role?: string,
    @Body('semesterId') semesterId?: string
  ) {
    const activeRole = role || 'STUDENT';
    return this.scoringService.submitCriteria(formId, criteriaId, score, activeRole, studentId, req.user.id, proofUrl, semesterId);
  }

  @Post(':formId/submit')
  async submitForm(
    @Param('formId') formId: string,
    @Body('studentId') studentId: string,
    @Req() req: any,
    @Body('role') role?: string,
    @Body('semesterId') semesterId?: string
  ) {
    const activeRole = role || 'STUDENT';
    return this.scoringService.submitForm(formId, activeRole, studentId, req.user.id, semesterId);
  }

  @Post(':formId/reject')
  async rejectForm(
    @Param('formId') formId: string,
    @Body('studentId') studentId: string,
    @Req() req: any,
    @Body('role') role?: string,
    @Body('semesterId') semesterId?: string,
    @Body('reason') reason?: string
  ) {
    const activeRole = role || 'STUDENT';
    return this.scoringService.rejectForm(formId, activeRole, studentId, req.user.id, semesterId, reason);
  }
}