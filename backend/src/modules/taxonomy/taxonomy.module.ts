import { Module } from '@nestjs/common';
import { TopicThemesController } from './topic-themes.controller.js';
import { TopicThemesService } from './topic-themes.service.js';

@Module({
  controllers: [TopicThemesController],
  providers: [TopicThemesService],
})
export class TaxonomyModule {}
