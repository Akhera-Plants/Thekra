import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Put, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard, Roles, RolesGuard } from '../../common/guards/admin.guard.js';
import { setCreated } from '../../common/http/set-created.js';
import { CreateReminderSetDto, SetReminderSetItemsDto, UpdateReminderSetDto } from './dto/reminder-set.dto.js';
import { ReminderSetsService } from './reminder-sets.service.js';

/** The curation desk's «مجموعات التذكير». */
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('admin/reminder-sets')
export class ReminderSetsAdminController {
  constructor(private readonly service: ReminderSetsService) {}

  @Get()
  findAll() {
    return this.service.adminList();
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.adminFind(id);
  }

  @Post()
  async create(@Body() dto: CreateReminderSetDto, @Res({ passthrough: true }) res: Response) {
    const set = await this.service.adminCreate(dto);
    setCreated(res, `/v1/admin/reminder-sets/${set.id}`);
    return { data: set };
  }

  @Patch(':id')
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateReminderSetDto) {
    return { data: await this.service.adminUpdate(id, dto) };
  }

  @Put(':id/items')
  async setItems(@Param('id', ParseUUIDPipe) id: string, @Body() dto: SetReminderSetItemsDto) {
    return { data: await this.service.adminSetItems(id, dto.quoteIds) };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.adminDelete(id);
  }
}
