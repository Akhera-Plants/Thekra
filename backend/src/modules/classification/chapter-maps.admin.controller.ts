import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { IsBoolean, IsOptional, IsUUID } from 'class-validator';
import type { Response } from 'express';
import { JwtAuthGuard, Roles, RolesGuard } from '../../common/guards/admin.guard.js';
import { setCreated } from '../../common/http/set-created.js';
import { ChapterMapsService } from './chapter-maps.service.js';
import { CreateChapterMapDto } from './dto/create-chapter-map.dto.js';

class ChapterMapListQueryDto {
  @IsOptional()
  @IsUUID()
  sourceId?: string;
}

class UpdateChapterMapDto {
  @IsBoolean()
  reviewed!: boolean;
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('admin/chapter-maps')
export class ChapterMapsAdminController {
  constructor(private readonly maps: ChapterMapsService) {}

  @Post()
  async create(
    @Body() dto: CreateChapterMapDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.maps.create(dto);
    setCreated(res, `/v1/admin/chapter-maps/${result.data.id}`);
    return result;
  }

  @Get()
  list(@Query() query: ChapterMapListQueryDto) {
    return this.maps.list(query.sourceId);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateChapterMapDto,
  ) {
    return this.maps.updateReviewed(id, dto.reviewed);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.maps.remove(id);
  }
}
