import { Module } from '@nestjs/common';
import {
  GoodDeedQuotesAdminController,
  SinQuotesAdminController,
} from './classification.admin.controller.js';
import { ClassificationService } from './classification.service.js';

@Module({
  controllers: [SinQuotesAdminController, GoodDeedQuotesAdminController],
  providers: [ClassificationService],
  exports: [ClassificationService],
})
export class ClassificationModule {}
