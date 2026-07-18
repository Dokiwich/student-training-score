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
  async getAllCriteria(@Query('semesterId') semesterId?: string) {
    return await this.scoringService.getAllCriteria(semesterId);
  }

  @Get('progress')
  async getScoringProgress(
    @Query('studentId') studentId: string, 
    @Req() req: any,
    @Query('sheetId') sheetId?: string,
    @Query('semesterId') semesterId?: string
  ) {
    const targetStudentId = studentId || req.user.id;
    return this.scoringService.getScoringProgress(targetStudentId, req.user.id, sheetId, semesterId);
  }

  @Get(':formId/scores')
  async getFormScores(
    @Param('formId') formId: string, 
    @Query('studentId') studentId: string, 
    @Req() req: any,
    @Query('semesterId') semesterId?: string
  ) {
    return this.scoringService.getScoresByFormId(formId, studentId, req.user.id, semesterId);
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

  @Post(':formId/delete-criteria')
  async deleteCriteria(
    @Param('formId') formId: string,
    @Body('criteriaId') criteriaId: number,
    @Body('studentId') studentId: string,
    @Req() req: any,
    @Body('role') role?: string,
    @Body('semesterId') semesterId?: string
  ) {
    const activeRole = role || 'STUDENT';
    return this.scoringService.deleteCriteriaScore(formId, criteriaId, activeRole, studentId, req.user.id, semesterId);
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