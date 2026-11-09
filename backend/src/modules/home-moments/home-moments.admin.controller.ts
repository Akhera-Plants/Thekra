import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard, Roles, RolesGuard } from '../../common/guards/admin.guard.js';
import { setCreated } from '../../common/http/set-created.js';
import { CreateHomeMomentDto, UpdateHomeMomentDto } from './dto/home-moment.dto.js';
import { HomeMomentsService } from './home-moments.service.js';

/** The desk's «في لحظات مثل هذه». Public changes show within the CDN window (PUBLIC_CACHE.content). */
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('admin/home-moments')
export class HomeMomentsAdminController {
  constructor(private readonly service: HomeMomentsService) {}

  @Get()
  findAll() {
    return this.service.adminList();
  }

  @Post()
  async create(@Body() dto: CreateHomeMomentDto, @Res({ passthrough: true }) res: Response) {
    const moment = await this.service.adminCreate(dto);
    setCreated(res, `/v1/admin/home-moments/${moment.id}`);
    return { data: moment };
  }

  @Patch(':id')
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateHomeMomentDto) {
    return { data: await this.service.adminUpdate(id, dto) };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.adminDelete(id);
  }
}
