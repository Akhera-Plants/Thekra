import { Controller, Get, Param, Query } from '@nestjs/common';
import { LocaleQueryDto } from '../../common/dto/locale-query.dto.js';
import { PUBLIC_CACHE, PublicCache } from '../../common/http/public-cache.js';
import { ReminderSetsService } from './reminder-sets.service.js';

/** Public «مجموعات التذكير»: published sets with their texts (reader gate, quote serializer). */
@Controller('reminder-sets')
export class ReminderSetsController {
  constructor(private readonly service: ReminderSetsService) {}

  @Get()
  @PublicCache(PUBLIC_CACHE.content)
  findAll(@Query() query: LocaleQueryDto) {
    return this.service.findPublished(query.lang ?? 'ar');
  }

  @Get(':slug')
  @PublicCache(PUBLIC_CACHE.content)
  findOne(@Param('slug') slug: string, @Query() query: LocaleQueryDto) {
    return this.service.findPublishedBySlug(slug, query.lang ?? 'ar');
  }
}
