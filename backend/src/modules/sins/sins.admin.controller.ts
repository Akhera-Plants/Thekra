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
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { CreateSinDto } from './dto/create-sin.dto.js';
import { UpdateSinDto } from './dto/update-sin.dto.js';
import { SinsService } from './sins.service.js';
import { IsBoolean, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

class DeleteSinQueryDto {
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  force?: boolean;
}

@Controller('admin/sins')
export class SinsAdminController {
  constructor(private readonly sinsService: SinsService) {}

  @Post()
  async create(
    @Body() dto: CreateSinDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const sin = await this.sinsService.adminCreate(dto);
    res.status(HttpStatus.CREATED);
    res.header('Location', `/v1/admin/sins/${sin.id}`);
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
