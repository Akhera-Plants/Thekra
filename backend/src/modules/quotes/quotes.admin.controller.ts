import { ArrayMaxSize, ArrayUnique, IsArray, IsUUID } from 'class-validator';
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
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard, Roles, RolesGuard } from '../../common/guards/admin.guard.js';
import { setCreated } from '../../common/http/set-created.js';
import { LanguageCodePipe } from '../../common/pipes/language-code.pipe.js';
import { AdminQuotesQueryDto } from './dto/admin-quotes-query.dto.js';
import { CreateQuoteDto } from './dto/create-quote.dto.js';
import { CreateTranslationDto } from './dto/create-translation.dto.js';
import { SetTranslationDto } from './dto/set-translation.dto.js';
import { UpdateQuoteDto } from './dto/update-quote.dto.js';
import { QuotesService } from './quotes.service.js';

class SetTagsDto {
  @IsArray()
  @IsUUID('4', { each: true })
  @ArrayMaxSize(20)
  /** P2-5: duplicate IDs would cause a misleading 422 ("tag not found") or a P2002
   * constraint violation; reject them here before they reach the service. */
  @ArrayUnique()
  tagIds!: string[];
}

function mapTranslation(t: { id: string; languageCode: string; text: string }) {
  return { id: t.id, languageCode: t.languageCode, text: t.text };
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('admin/quotes')
export class QuotesAdminController {
  constructor(private readonly quotesService: QuotesService) {}

  @Post()
  async create(
    @Body() dto: CreateQuoteDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const quote = await this.quotesService.adminCreate(dto);
    setCreated(res, `/v1/admin/quotes/${quote.id}`);
    return { data: quote };
  }

  @Get()
  findAll(@Query() query: AdminQuotesQueryDto) {
    return this.quotesService.adminSearch(query);
  }

  @Post(':id/text-verification')
  markTextVerified(@Param('id', ParseUUIDPipe) id: string) {
    return this.quotesService.markTextVerified(id);
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
  async upsertTranslation(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('languageCode', LanguageCodePipe) languageCode: string,
    @Body() body: SetTranslationDto,
  ) {
    const t = await this.quotesService.upsertTranslation(id, languageCode, body.text);
    return mapTranslation(t);
  }

  @Post(':id/translations')
  async createTranslation(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: CreateTranslationDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const t = await this.quotesService.createTranslation(id, body.languageCode, body.text);
    setCreated(res, `/v1/admin/quotes/${id}/translations/${t.languageCode}`);
    return mapTranslation(t);
  }

  @Delete(':id/translations/:languageCode')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteTranslation(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('languageCode', LanguageCodePipe) languageCode: string,
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
