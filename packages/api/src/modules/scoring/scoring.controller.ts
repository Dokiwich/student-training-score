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

  @Get('class-committee/students')
  async getClassCommitteeStudents(@Req() req: any, @Query('classId') requestedClassId?: string) {
    const userId = req.user?.id;
    return this.scoringService.getAuthorizedStudentList(userId, 'CLASS_COMMITTEE', 'SINGLE_CLASS', requestedClassId);
  }

  @Get('advisor/students')
  async getAdvisorStudents(@Req() req: any) {
    const userId = req.user?.id;
    return this.scoringService.getAuthorizedStudentList(userId, 'ADVISOR', 'ALL_ASSIGNED_CLASSES');
  }

  @Get('advisor/classes')
  async getAdvisorClasses(@Req() req: any) {
    const userId = req.user?.id;
    return this.scoringService.getAdvisorClasses(userId);
  }

  @Get('advisor/classes/:classId/students')
  async getAdvisorStudentsByClass(@Req() req: any, @Param('classId') classId: string) {
    const userId = req.user?.id;
    return this.scoringService.getAuthorizedStudentList(userId, 'ADVISOR', 'SINGLE_CLASS', classId);
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

  @Get(':formId/validate')
  async validateForm(
    @Param('formId') formId: string,
    @Req() req: any,
    @Query('role') role?: string
  ) {
    const activeRole = role || 'STUDENT';
    const { errors } = await this.scoringService.validateFormForSubmission(formId, req.user.id, activeRole);
    return { 
      isValid: errors ? errors.length === 0 : true, 
      errors: errors || [] 
    };
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

  @Post('class-committee/bulk-approve')
  async classCommitteeBulkApprove(
    @Body('formIds') formIds: any[],
    @Req() req: any
  ) {
    return this.scoringService.bulkApprove(formIds, 'CLASS_COMMITTEE', req.user.id);
  }

  @Post('class-committee/bulk-reject')
  async classCommitteeBulkReject(
    @Body('formIds') formIds: any[],
    @Body('reason') reason: any,
    @Req() req: any
  ) {
    return this.scoringService.bulkReject(formIds, 'CLASS_COMMITTEE', req.user.id, reason);
  }

  @Post('advisor/bulk-approve')
  async advisorBulkApprove(
    @Body('formIds') formIds: any[],
    @Req() req: any
  ) {
    return this.scoringService.bulkApprove(formIds, 'ADVISOR', req.user.id);
  }

  @Post('advisor/bulk-reject')
  async advisorBulkReject(
    @Body('formIds') formIds: any[],
    @Body('reason') reason: any,
    @Req() req: any
  ) {
    return this.scoringService.bulkReject(formIds, 'ADVISOR', req.user.id, reason);
  }

}
