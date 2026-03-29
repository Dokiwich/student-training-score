import { Controller, Post, Param, Body, UseGuards, Req } from '@nestjs/common';
import { WorkflowService } from './workflow.service';
import { WorkflowAction } from '@student-score/shared';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller('workflow')
@UseGuards(JwtAuthGuard)
export class WorkflowController {
  constructor(private readonly workflowService: WorkflowService) {}

  @Post('transition/:formId')
  async transition(
    @Param('formId') formId: string,
    @Body('action') action: WorkflowAction,
    @Req() req: any
  ) {
    return this.workflowService.transitionForm(formId, action, req.user.id, req.user.role);
  }
}