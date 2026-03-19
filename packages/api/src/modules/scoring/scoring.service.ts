import { Injectable, BadRequestException } from '@nestjs/common';
import { prisma, WorkflowStatus } from '@student-score/database';
import { randomUUID } from 'crypto';

@Injectable()
export class ScoringService {

  // Sinh viên tự chấm điểm 1 tiêu chí
  async saveStudentScore(
    formId: string,
    criteriaId: number,
    score: number,
  ) {
    // Kiểm tra phiếu điểm có tồn tại không
    const form = await prisma.scoring_sheets.findUnique({
      where: { id: formId },
    });

    if (!form) {
      throw new BadRequestException('Không tìm thấy phiếu điểm!');
    }

    if (form.status !== WorkflowStatus.DRAFT) {
      throw new BadRequestException('Chỉ được chấm khi phiếu đang ở trạng thái Nháp!');
    }

    // Kiểm tra tiêu chí có tồn tại và validate max_points
    const criteria = await prisma.criteria.findUnique({
      where: { id: criteriaId },
    });

    if (!criteria) {
      throw new BadRequestException('Không tìm thấy tiêu chí!');
    }

    if (!criteria.is_active) {
      throw new BadRequestException('Tiêu chí này đã bị vô hiệu hóa!');
    }

    if (score > criteria.max_points) {
      throw new BadRequestException(
        `Điểm không được vượt quá ${criteria.max_points} (tối đa tiêu chí "${criteria.code}")`,
      );
    }

    if (score < criteria.min_score) {
      throw new BadRequestException(
        `Điểm không được thấp hơn ${criteria.min_score} (tối thiểu tiêu chí "${criteria.code}")`,
      );
    }

    // Lưu hoặc cập nhật điểm
    const detail = await prisma.score_details.upsert({
      where: {
        scoring_sheet_id_criteria_id: {
          scoring_sheet_id: formId,
          criteria_id: criteriaId,
        },
      },
      update: { student_score: score },
      create: {
        id: randomUUID(),
        student_score: score,
        scoring_sheets: { connect: { id: formId } },
        criteria: { connect: { id: criteriaId } },
      },
    });

    return {
      message: 'Lưu điểm thành công',
      data: detail,
    };
  }

  // Lấy toàn bộ điểm của 1 phiếu
  async getScoresByFormId(formId: string) {
    const scores = await prisma.score_details.findMany({
      where: { scoring_sheet_id: formId },
      include: { criteria: true },
      orderBy: { criteria_id: 'asc' },
    });

    return {
      message: 'Lấy danh sách điểm thành công',
      data: scores,
    };
  }
}