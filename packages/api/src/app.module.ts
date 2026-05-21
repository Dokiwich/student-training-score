import { Module } from '@nestjs/common';
import { ScoringModule } from './modules/scoring/scoring.module';
import { WorkflowModule } from './modules/workflow/workflow.module';
import { DepartmentModule } from './modules/department/department.module';

@Module({
  // Bất kỳ Module nào tạo mới đều phải được cắm (import) vào đây
  imports: [ScoringModule, WorkflowModule, DepartmentModule],
  controllers: [],
  providers: [],
})
export class AppModule {}