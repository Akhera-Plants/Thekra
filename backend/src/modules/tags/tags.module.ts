import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { TagsAdminController } from './tags.admin.controller.js';
import { TagsController } from './tags.controller.js';
import { TagsService } from './tags.service.js';

@Module({
  imports: [AuthModule],
  controllers: [TagsController, TagsAdminController],
  providers: [TagsService],
  exports: [TagsService],
})
export class TagsModule {}
