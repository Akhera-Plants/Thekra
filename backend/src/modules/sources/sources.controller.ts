import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { SourcesQueryDto } from './dto/sources-query.dto.js';
import { SourcesService } from './sources.service.js';

@Controller('sources')
export class SourcesController {
  constructor(private readonly sourcesService: SourcesService) {}

  @Get()
  findAll(@Query() query: SourcesQueryDto) {
    return this.sourcesService.findAll(query);
  }

  @Get(':id')
  findById(@Param('id', ParseUUIDPipe) id: string) {
    return this.sourcesService.findById(id);
  }
}
