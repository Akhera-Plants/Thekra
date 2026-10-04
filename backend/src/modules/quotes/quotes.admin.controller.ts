import {
  ArrayMaxSize,
  IsArray,
  IsUUID,
} from 'class-validator';
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
  Put,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { AdminQuotesQueryDto } from './dto/admin-quotes-query.dto.js';
import { CreateQuoteDto } from './dto/create-quote.dto.js';
import { UpdateQuoteDto } from './dto/update-quote.dto.js';
import { QuotesService } from './quotes.service.js';

class SetTranslationDto {
  text!: string;
}

class CreateTranslationDto {
  languageCode!: string;
  text!: string;
}

class SetTagsDto {
  @IsArray()
  @IsUUID('4', { each: true })
  @ArrayMaxSize(20)
  tagIds!: string[];
}

@Controller('admin/quotes')
export class QuotesAdminController {
  constructor(private readonly quotesService: QuotesService) {}

  @Post()
  async create(
    @Body() dto: CreateQuoteDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const quote = await this.quotesService.adminCreate(dto);
    res.status(HttpStatus.CREATED);
    res.header('Location', `/v1/admin/quotes/${quote.id}`);
    return { data: quote };
  }

  @Get()
  findAll(@Query() query: AdminQuotesQueryDto) {
    return this.quotesService.adminSearch(query);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateQuoteDto,
  ) {
    return this.quotesService.adminUpdate(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.quotesService.adminDelete(id);
  }

  // ── Translation sub-routes ────────────────────────────────────────────────

  @Put(':id/translations/:languageCode')
  upsertTranslation(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('languageCode') languageCode: string,
    @Body() body: SetTranslationDto,
  ) {
    return this.quotesService.upsertTranslation(id, languageCode, body.text);
  }

  @Post(':id/translations')
  @HttpCode(HttpStatus.CREATED)
  createTranslation(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: CreateTranslationDto,
  ) {
    return this.quotesService.createTranslation(id, body.languageCode, body.text);
  }

  @Delete(':id/translations/:languageCode')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteTranslation(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('languageCode') languageCode: string,
  ) {
    return this.quotesService.deleteTranslation(id, languageCode);
  }

  // ── Tag assignment ────────────────────────────────────────────────────────

  @Put(':id/tags')
  setTags(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: SetTagsDto,
  ) {
    return this.quotesService.setQuoteTags(id, body.tagIds);
  }
}
