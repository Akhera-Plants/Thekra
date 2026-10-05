import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { AdminApiKeyGuard } from '../../common/guards/admin-api-key.guard.js';
import { setCreated } from '../../common/http/set-created.js';
import { CreateTagDto } from './dto/create-tag.dto.js';
import { UpdateTagDto } from './dto/update-tag.dto.js';
import { TagsService } from './tags.service.js';

@UseGuards(AdminApiKeyGuard)
@Controller('admin/tags')
export class TagsAdminController {
  constructor(private readonly tagsService: TagsService) {}

  @Post()
  async create(
    @Body() dto: CreateTagDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const tag = await this.tagsService.adminCreate(dto);
    setCreated(res, `/v1/admin/tags/${tag.id}`);
    return { data: tag };
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTagDto,
  ) {
    return this.tagsService.adminUpdate(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.tagsService.adminDelete(id);
  }
}
