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
import { CreateGoodDeedDto } from './dto/create-good-deed.dto.js';
import { UpdateGoodDeedDto } from './dto/update-good-deed.dto.js';
import { GoodDeedsService } from './good-deeds.service.js';

@UseGuards(AdminApiKeyGuard)
@Controller('admin/good-deeds')
export class GoodDeedsAdminController {
  constructor(private readonly goodDeedsService: GoodDeedsService) {}

  @Post()
  async create(
    @Body() dto: CreateGoodDeedDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const deed = await this.goodDeedsService.adminCreate(dto);
    res.status(HttpStatus.CREATED);
    res.header('Location', `/v1/admin/good-deeds/${deed.id}`);
    return { data: deed };
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateGoodDeedDto,
  ) {
    return this.goodDeedsService.adminUpdate(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.goodDeedsService.adminDelete(id);
  }
}
