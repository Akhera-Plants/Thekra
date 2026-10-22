import { Controller, Get, Param, Query } from '@nestjs/common';
import { TagDetailQueryDto } from './dto/tag-detail-query.dto.js';
import { TagsQueryDto } from './dto/tags-query.dto.js';
import { TagsService } from './tags.service.js';

@Controller('tags')
export class TagsController {
  constructor(private readonly tagsService: TagsService) {}

  @Get()
  findAll(@Query() query: TagsQueryDto) {
    return this.tagsService.findAll(query);
  }

  @Get(':slug')
  findBySlug(@Param('slug') slug: string, @Query() query: TagDetailQueryDto) {
    return this.tagsService.findBySlug(slug, query);
  }
}
