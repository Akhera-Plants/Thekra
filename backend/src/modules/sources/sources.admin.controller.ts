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
} from '@nestjs/common';
import type { Response } from 'express';
import { CreateSourceDto } from './dto/create-source.dto.js';
import { UpdateSourceDto } from './dto/update-source.dto.js';
import { SourcesService } from './sources.service.js';

@Controller('admin/sources')
export class SourcesAdminController {
  constructor(private readonly sourcesService: SourcesService) {}

  @Post()
  async create(
    @Body() dto: CreateSourceDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const source = await this.sourcesService.adminCreate(dto);
    res.status(HttpStatus.CREATED);
    res.header('Location', `/v1/admin/sources/${source.id}`);
    return { data: source };
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSourceDto,
  ) {
    return this.sourcesService.adminUpdate(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.sourcesService.adminDelete(id);
  }
}
