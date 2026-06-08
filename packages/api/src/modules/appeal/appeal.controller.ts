import { Controller, Get, Post, Param, Body, UseGuards, Req, Query } from '@nestjs/common';
import { AppealService } from './appeal.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller('appeal')
@UseGuards(JwtAuthGuard)
export class AppealController {
  constructor(private readonly appealService: AppealService) {}

  // =============================================
  // GET /api/appeal
  // Lấy danh sách khiếu nại theo role của user đang đăng nhập
  // =============================================
  @Get()
  async getAppeals(@Req() req: any, @Query('semesterId') semesterId?: string) {
    const userId = req.user?.id;
    const role = req.user?.role || 'STUDENT';
    return this.appealService.getAppealsByRole(userId, role, semesterId);
  }

  // =============================================
  // POST /api/appeal/submit
  // Sinh viên gửi khiếu nại mới
  // Body: { scoring_sheet_id, reason, appeal_type, criteria_ids }
  // =============================================
  @Post('submit')
  async submitAppeal(
    @Req() req: any,
    @Body('scoring_sheet_id') sheetId: string,
    @Body('reason') reason: string,
    @Body('appeal_type') appealType: 'class' | 'advisor',
    @Body('criteria_ids') criteriaIds: number[],
  ) {
    const studentId = req.user?.id;
    return this.appealService.submitAppeal(studentId, sheetId, reason, appealType, criteriaIds);
  }

  // =============================================
  // POST /api/appeal/:id/resolve
  // ADVISOR / SCHOOL_ADMIN xử lý 1 khiếu nại
  // Body: { decision: 'ACCEPTED'|'REJECTED', resolution, newScore? }
  // =============================================
  @Post(':id/resolve')
  async resolveAppeal(
    @Param('id') appealId: string,
    @Req() req: any,
    @Body('decision') decision: 'ACCEPTED' | 'REJECTED',
    @Body('resolution') resolution: string,
    @Body('newScore') newScore?: number,
  ) {
    const resolverId = req.user?.id;
    return this.appealService.resolveAppeal(appealId, resolverId, decision, resolution, newScore);
  }

  // =============================================
  // POST /api/appeal/resolve-all/:sheetId
  // ADVISOR / SCHOOL_ADMIN xử lý tất cả PENDING trên 1 phiếu
  // Body: { resolution? }
  // =============================================
  @Post('resolve-all/:sheetId')
  async resolveAll(
    @Param('sheetId') sheetId: string,
    @Req() req: any,
    @Body('resolution') resolution?: string,
  ) {
    const resolverId = req.user?.id;
    return this.appealService.resolveAllAppeals(sheetId, resolverId, resolution);
  }
}
