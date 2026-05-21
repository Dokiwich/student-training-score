import { Controller, Get, UseGuards, Req } from '@nestjs/common';
import { DepartmentService } from './department.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller('department')
@UseGuards(JwtAuthGuard)
export class DepartmentController {
  constructor(private readonly departmentService: DepartmentService) {}

  /**
   * GET /api/department/students
   * Lấy danh sách tất cả sinh viên trong khoa (tất cả lớp)
   */
  @Get('students')
  async getStudents(@Req() req: any) {
    return this.departmentService.getStudentsByDepartment(req.user?.id);
  }

  /**
   * GET /api/department/stats
   * Thống kê tổng hợp cấp khoa (sĩ số, xếp loại, điểm TB theo lớp)
   */
  @Get('stats')
  async getStats(@Req() req: any) {
    return this.departmentService.getDepartmentStats(req.user?.id);
  }
}
