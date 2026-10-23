import { Controller, Get } from '@nestjs/common';
import { TopicThemesService } from './topic-themes.service.js';
import { PUBLIC_CACHE, PublicCache } from '../../common/http/public-cache.js';

@Controller('topic-themes')
export class TopicThemesController {
  constructor(private readonly themes: TopicThemesService) {}

  /** Theme labels for the catalogue search; changes only with import:taxonomy. */
  @Get()
  @PublicCache(PUBLIC_CACHE.content)
  index() {
    return this.themes.index();
  }
}
