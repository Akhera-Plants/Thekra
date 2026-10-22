import { Controller, Get, Header } from '@nestjs/common';
import { TopicThemesService } from './topic-themes.service.js';

@Controller('topic-themes')
export class TopicThemesController {
  constructor(private readonly themes: TopicThemesService) {}

  /** Theme labels for the catalogue search; changes only with import:taxonomy. */
  @Get()
  @Header('Cache-Control', 'public, max-age=300, stale-while-revalidate=60')
  index() {
    return this.themes.index();
  }
}
