import { Controller, Get, Query } from '@nestjs/common';
import { LocaleQueryDto } from '../../common/dto/locale-query.dto.js';
import { PUBLIC_CACHE, PublicCache } from '../../common/http/public-cache.js';
import { HomeMomentsService } from './home-moments.service.js';

/** Public home «في لحظات مثل هذه» (round 6, C-09): the same list for every user, CDN-cached. */
@Controller('home-moments')
export class HomeMomentsController {
  constructor(private readonly service: HomeMomentsService) {}

  @Get()
  @PublicCache(PUBLIC_CACHE.content)
  findAll(@Query() query: LocaleQueryDto) {
    return this.service.findPublic(query.lang ?? 'ar');
  }
}
