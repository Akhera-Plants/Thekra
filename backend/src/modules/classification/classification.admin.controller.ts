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
import { JwtAuthGuard, Roles, RolesGuard } from '../../common/guards/admin.guard.js';
import { ClassificationService } from './classification.service.js';
import { BulkLinkGoodDeedQuotesDto } from './dto/bulk-link-good-deed-quotes.dto.js';
import { BulkLinkSinQuotesDto } from './dto/bulk-link-sin-quotes.dto.js';
import { GoodDeedQuotesAdminQueryDto } from './dto/good-deed-quotes-admin-query.dto.js';
import { LinkGoodDeedQuoteDto } from './dto/link-good-deed-quote.dto.js';
import { LinkSinQuoteDto } from './dto/link-sin-quote.dto.js';
import { RevokeGoodDeedGroupDto, RevokeSinGroupDto } from './dto/revoke-link-group.dto.js';
import { SinQuotesAdminQueryDto } from './dto/sin-quotes-admin-query.dto.js';
import { UpdateGoodDeedLinkDto } from './dto/update-good-deed-link.dto.js';
import { UpdateSinLinkDto } from './dto/update-sin-link.dto.js';

// ─── Sin-Quote admin endpoints (#48–52) ───────────────────────────────────────

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('admin/sin-quotes')
export class SinQuotesAdminController {
  constructor(private readonly classificationService: ClassificationService) {}

  @Post()
  async linkSinQuote(
    @Body() dto: LinkSinQuoteDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { created, link } = await this.classificationService.linkSinQuote(dto);
    if (created) {
      res.status(HttpStatus.CREATED);
      res.header('Location', `/v1/admin/sin-quotes/${link.id}`);
    } else {
      res.status(HttpStatus.OK);
    }
    return { data: link };
  }

  @Get()
  listSinQuotes(@Query() query: SinQuotesAdminQueryDto) {
    return this.classificationService.listSinQuotes(query);
  }

  @Patch(':id')
  updateSinLink(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSinLinkDto,
  ) {
    return this.classificationService.updateSinLink(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  unlinkSinQuote(@Param('id', ParseUUIDPipe) id: string) {
    return this.classificationService.unlinkSinQuote(id);
  }

  @Post('bulk')
  @HttpCode(HttpStatus.OK)
  bulkLinkSinQuotes(@Body() dto: BulkLinkSinQuotesDto) {
    return this.classificationService.bulkLinkSinQuotes(dto);
  }

  @Post('revoke')
  @HttpCode(HttpStatus.OK)
  revokeSinGroup(@Body() dto: RevokeSinGroupDto) {
    return this.classificationService.revokeSinGroup(dto.sinId, dto.classifiedBy);
  }
}

// ─── GoodDeed-Quote admin endpoints (#53–57) ──────────────────────────────────

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('admin/good-deed-quotes')
export class GoodDeedQuotesAdminController {
  constructor(private readonly classificationService: ClassificationService) {}

  @Post()
  async linkGoodDeedQuote(
    @Body() dto: LinkGoodDeedQuoteDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { created, link } = await this.classificationService.linkGoodDeedQuote(dto);
    if (created) {
      res.status(HttpStatus.CREATED);
      res.header('Location', `/v1/admin/good-deed-quotes/${link.id}`);
    } else {
      res.status(HttpStatus.OK);
    }
    return { data: link };
  }

  @Get()
  listGoodDeedQuotes(@Query() query: GoodDeedQuotesAdminQueryDto) {
    return this.classificationService.listGoodDeedQuotes(query);
  }

  @Patch(':id')
  updateGoodDeedLink(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateGoodDeedLinkDto,
  ) {
    return this.classificationService.updateGoodDeedLink(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  unlinkGoodDeedQuote(@Param('id', ParseUUIDPipe) id: string) {
    return this.classificationService.unlinkGoodDeedQuote(id);
  }

  @Post('bulk')
  @HttpCode(HttpStatus.OK)
  bulkLinkGoodDeedQuotes(@Body() dto: BulkLinkGoodDeedQuotesDto) {
    return this.classificationService.bulkLinkGoodDeedQuotes(dto);
  }

  @Post('revoke')
  @HttpCode(HttpStatus.OK)
  revokeGoodDeedGroup(@Body() dto: RevokeGoodDeedGroupDto) {
    return this.classificationService.revokeGoodDeedGroup(dto.goodDeedId, dto.classifiedBy);
  }
}
