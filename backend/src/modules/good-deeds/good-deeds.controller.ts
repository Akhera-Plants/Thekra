import { Controller, Get, Param, Query } from '@nestjs/common';
import { GoodDeedQuotesQueryDto } from '../sins/dto/sin-quotes-query.dto.js';
import { GoodDeedsQueryDto } from './dto/good-deeds-query.dto.js';
import { GoodDeedsService } from './good-deeds.service.js';

@Controller('good-deeds')
export class GoodDeedsController {
  constructor(private readonly goodDeedsService: GoodDeedsService) {}

  @Get()
  findAll(@Query() query: GoodDeedsQueryDto) {
    return this.goodDeedsService.findAll(query);
  }

  @Get(':slug')
  findBySlug(@Param('slug') slug: string) {
    return this.goodDeedsService.findBySlug(slug);
  }

  @Get(':slug/quotes')
  findQuotes(
    @Param('slug') slug: string,
    @Query() query: GoodDeedQuotesQueryDto,
  ) {
    return this.goodDeedsService.findQuotesForGoodDeed(slug, query);
  }
}
