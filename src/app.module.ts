import { Module } from '@nestjs/common';

import { WorkflowModule } from '@/workflow/workflow.module';
import { UserModule } from './user/user.module';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [ScheduleModule.forRoot(), WorkflowModule, UserModule],
})
export class AppModule {}
