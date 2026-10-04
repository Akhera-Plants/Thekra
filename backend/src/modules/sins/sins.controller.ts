import { Controller, Get, Param, Query } from '@nestjs/common';
import { LocaleQueryDto } from '../../common/dto/locale-query.dto.js';
import { SinGoodDeedsQueryDto } from './dto/sin-good-deeds-query.dto.js';
import { SinQuotesQueryDto } from './dto/sin-quotes-query.dto.js';
import { SinsQueryDto } from './dto/sins-query.dto.js';
import { SinsService } from './sins.service.js';

@Controller('sins')
export class SinsController {
  constructor(private readonly sinsService: SinsService) {}

  @Get()
  findAll(@Query() query: SinsQueryDto) {
    return this.sinsService.findAll(query);
  }

  @Get(':slug')
  findBySlug(
    @Param('slug') slug: string,
    @Query() query: LocaleQueryDto,
  ) {
    return this.sinsService.findBySlug(slug, query.lang ?? 'ar');
  }

  @Get(':slug/quotes')
  findQuotes(@Param('slug') slug: string, @Query() query: SinQuotesQueryDto) {
    return this.sinsService.findQuotesForSin(slug, query);
  }

  @Get(':slug/good-deeds')
  findGoodDeeds(
    @Param('slug') slug: string,
    @Query() query: SinGoodDeedsQueryDto,
  ) {
    return this.sinsService.findGoodDeedsForSin(
      slug,
      query.page ?? 1,
      query.limit ?? 20,
      query.lang ?? 'ar',
    );
  }
}
