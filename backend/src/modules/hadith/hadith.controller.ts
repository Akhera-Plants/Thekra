import { Controller, Get, Query } from '@nestjs/common';
import { HadithCollectionsQueryDto } from './dto/hadith-collections-query.dto.js';
import { HadithQueryDto } from './dto/hadith-query.dto.js';
import { HadithService } from './hadith.service.js';

@Controller('hadith')
export class HadithController {
  constructor(private readonly hadithService: HadithService) {}

  @Get('collections')
  listCollections(@Query() query: HadithCollectionsQueryDto) {
    return this.hadithService.listCollections(query);
  }

  @Get()
  findAll(@Query() query: HadithQueryDto) {
    return this.hadithService.findAll(query);
  }
}
