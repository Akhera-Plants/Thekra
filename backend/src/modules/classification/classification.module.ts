import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { BranchQuotesAdminController } from './branch-quotes.admin.controller.js';
import { ChapterMapsAdminController } from './chapter-maps.admin.controller.js';
import { ChapterMapsService } from './chapter-maps.service.js';
import {
  GoodDeedQuotesAdminController,
  SinQuotesAdminController,
} from './classification.admin.controller.js';
import { ClassificationService } from './classification.service.js';

@Module({
  imports: [AuthModule],
  controllers: [
    SinQuotesAdminController,
    GoodDeedQuotesAdminController,
    BranchQuotesAdminController,
    ChapterMapsAdminController,
  ],
  providers: [ClassificationService, ChapterMapsService],
  exports: [ClassificationService],
})
export class ClassificationModule {}
