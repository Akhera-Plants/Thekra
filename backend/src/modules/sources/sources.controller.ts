import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { SourcesQueryDto } from './dto/sources-query.dto.js';
import { SourcesService } from './sources.service.js';
import { PUBLIC_CACHE, PublicCache } from '../../common/http/public-cache.js';

@Controller('sources')
export class SourcesController {
  constructor(private readonly sourcesService: SourcesService) {}

  @Get()
  @PublicCache(PUBLIC_CACHE.reference)
  findAll(@Query() query: SourcesQueryDto) {
    return this.sourcesService.findAll(query);
  }

  @Get(':id')
  @PublicCache(PUBLIC_CACHE.reference)
  findById(@Param('id', ParseUUIDPipe) id: string) {
    return this.sourcesService.findById(id);
  }
}
