import { Controller, Get, Param, Query } from '@nestjs/common';
import { PUBLIC_CACHE, PublicCache } from '../../common/http/public-cache.js';
import { NamesQueryDto } from './dto/names-query.dto.js';
import { NamesOfAllahService } from './names-of-allah.service.js';

/** «الأسماء الحسنى» (redesign §4.7): the fourth door of «أبواب الخير». Public, CDN-cached like the topic pages. */
@Controller('names-of-allah')
export class NamesOfAllahController {
  constructor(private readonly names: NamesOfAllahService) {}

  @Get()
  @PublicCache(PUBLIC_CACHE.content)
  findAll() {
    return this.names.findAll();
  }

  @Get(':slug')
  @PublicCache(PUBLIC_CACHE.content)
  findOne(@Param('slug') slug: string, @Query() query: NamesQueryDto) {
    return this.names.findBySlug(slug, query.lang ?? 'ar');
  }
}
