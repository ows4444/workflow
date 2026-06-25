import { Module } from '@nestjs/common';

import { UserModule } from './user/user.module';
import { ScheduleModule } from '@nestjs/schedule';
import { WorkflowModule } from '@/workflow/public/workflow.module';

@Module({
  imports: [ScheduleModule.forRoot(), WorkflowModule, UserModule],
})
export class AppModule {}
