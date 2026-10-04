import { Module } from '@nestjs/common';
import { TagsAdminController } from './tags.admin.controller.js';
import { TagsController } from './tags.controller.js';
import { TagsService } from './tags.service.js';

@Module({
  controllers: [TagsController, TagsAdminController],
  providers: [TagsService],
  exports: [TagsService],
})
export class TagsModule {}
