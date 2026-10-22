import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { SourcesAdminController } from './sources.admin.controller.js';
import { SourcesController } from './sources.controller.js';
import { SourcesService } from './sources.service.js';

@Module({
  imports: [AuthModule],
  controllers: [SourcesController, SourcesAdminController],
  providers: [SourcesService],
  exports: [SourcesService],
})
export class SourcesModule {}
