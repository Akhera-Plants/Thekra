import { Controller, Get, Query } from '@nestjs/common';
import { HadithCollectionsQueryDto } from './dto/hadith-collections-query.dto.js';
import { HadithQueryDto } from './dto/hadith-query.dto.js';
import { HadithService } from './hadith.service.js';
import { PUBLIC_CACHE, PublicCache } from '../../common/http/public-cache.js';

@Controller('hadith')
export class HadithController {
  constructor(private readonly hadithService: HadithService) {}

  @Get('collections')
  @PublicCache(PUBLIC_CACHE.content)
  listCollections(@Query() query: HadithCollectionsQueryDto) {
    return this.hadithService.listCollections(query);
  }

  @Get()
  @PublicCache(PUBLIC_CACHE.content)
  findAll(@Query() query: HadithQueryDto) {
    return this.hadithService.findAll(query);
  }
}
