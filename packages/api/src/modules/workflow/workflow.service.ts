import { Injectable, BadRequestException } from '@nestjs/common';
import { prisma } from '@student-score/database'; 
// Import bộ luật xịn xò từ Shared
import { WORKFLOW_RULES, WorkflowAction } from '@student-score/shared';

@Injectable()
export class WorkflowService {
  async transitionForm(formId: string, action: WorkflowAction, userId: string, userRole: string) {
    const form = await prisma.scoring_sheets.findUnique({ where: { id: formId } });
    if (!form) throw new BadRequestException('Không tìm thấy phiếu!');

    const currentState = form.status;
    const allowedActions = WORKFLOW_RULES[currentState];

    // Ép kiểu action để TypeScript không kêu ca
    if (!allowedActions || !allowedActions[action as WorkflowAction]) {
      throw new BadRequestException(`Hành động '${action}' không hợp lệ khi phiếu đang ở trạng thái '${currentState}'`);
    }

    const nextState = allowedActions[action as WorkflowAction];

    const updatedForm = await prisma.scoring_sheets.update({
      where: { id: formId },
      data: { status: nextState as any } 
    });

    return {
      message: `Đã chuyển phiếu từ ${currentState} sang ${nextState}`,
      data: updatedForm
    };
  }
}