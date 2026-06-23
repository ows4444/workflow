import { Module } from '@nestjs/common';

import { WorkflowModule } from './workflow/workflow.module';
import { UserModule } from './user/user.module';

@Module({
  imports: [WorkflowModule, UserModule],
})
export class AppModule {}
