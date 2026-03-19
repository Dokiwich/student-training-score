import { Controller, Post, Param, Body } from '@nestjs/common';
import { WorkflowService } from './workflow.service';
import { WorkflowAction } from '@student-score/shared';
@Controller('workflow')
export class WorkflowController {
  constructor(private readonly workflowService: WorkflowService) {}

  @Post('transition/:formId')
  async transition(
    @Param('formId') formId: string,
    @Body('action') action:WorkflowAction // Truyền action (VD: "SUBMIT", "APPROVE", "REJECT") từ body
  ) {
    // Tạm thời hardcode role để test, sau này sẽ lấy từ Token đăng nhập
    return this.workflowService.transitionForm(formId, action, 'user_123', 'STUDENT');
  }
}