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
import type { Response } from 'express';
import { IsBoolean, IsOptional } from 'class-validator';
import { JwtAuthGuard, Roles, RolesGuard } from '../../common/guards/admin.guard.js';
import { setCreated } from '../../common/http/set-created.js';
import { ToBoolean } from '../../common/decorators/to-boolean.decorator.js';
import { CreateSinDto } from './dto/create-sin.dto.js';
import { SinsQueryDto } from './dto/sins-query.dto.js';
import { UpdateSinDto } from './dto/update-sin.dto.js';
import { SinsService } from './sins.service.js';

class DeleteSinQueryDto {
  @IsOptional()
  @ToBoolean()
  @IsBoolean()
  force?: boolean;
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('admin/sins')
export class SinsAdminController {
  constructor(private readonly sinsService: SinsService) {}

  /** Admin catalogue. Includes the editorial severity score, which public JSON omits. */
  @Get()
  findAll(@Query() query: SinsQueryDto) {
    return this.sinsService.adminList(query);
  }

  @Post()
  async create(
    @Body() dto: CreateSinDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const sin = await this.sinsService.adminCreate(dto);
    setCreated(res, `/v1/admin/sins/${sin.id}`);
    return { data: sin };
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSinDto,
  ) {
    return this.sinsService.adminUpdate(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: DeleteSinQueryDto,
  ) {
    return this.sinsService.adminDelete(id, query.force ?? false);
  }
}
