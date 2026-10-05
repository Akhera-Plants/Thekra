import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import {
  GoodDeedQuotesAdminController,
  SinQuotesAdminController,
} from './classification.admin.controller.js';
import { ClassificationService } from './classification.service.js';

@Module({
  imports: [AuthModule],
  controllers: [SinQuotesAdminController, GoodDeedQuotesAdminController],
  providers: [ClassificationService],
  exports: [ClassificationService],
})
export class ClassificationModule {}
