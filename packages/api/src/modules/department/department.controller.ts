import { Controller, Get, UseGuards, Req, Query } from '@nestjs/common';
import { DepartmentService } from './department.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller('department')
@UseGuards(JwtAuthGuard)
export class DepartmentController {
  constructor(private readonly departmentService: DepartmentService) {}

  /** GET /api/department/semesters — Danh sách học kỳ */
  @Get('semesters')
  async getSemesters() {
    return this.departmentService.getSemesters();
  }

  /** GET /api/department/students?semesterId=xxx */
  @Get('students')
  async getStudents(@Req() req: any, @Query('semesterId') semesterId?: string) {
    return this.departmentService.getStudentsByDepartment(req.user?.id, semesterId);
  }

  /** GET /api/department/stats?semesterId=xxx */
  @Get('stats')
  async getStats(@Req() req: any, @Query('semesterId') semesterId?: string) {
    return this.departmentService.getDepartmentStats(req.user?.id, semesterId);
  }

  /** GET /api/department/stats/compare — So sánh 3 HK gần nhất */
  @Get('stats/compare')
  async getStatsComparison(@Req() req: any) {
    return this.departmentService.getStatsComparison(req.user?.id);
  }
}
