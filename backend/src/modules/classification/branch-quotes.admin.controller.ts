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
import { UpdateSinLinkDto } from './dto/update-sin-link.dto.js';
import { BranchQuotesAdminQueryDto } from './dto/branch-quotes-admin-query.dto.js';
import { LinkBranchQuoteDto } from './dto/link-branch-quote.dto.js';
import { ClassificationService } from './classification.service.js';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('admin/branch-quotes')
export class BranchQuotesAdminController {
  constructor(private readonly classification: ClassificationService) {}

  @Post()
  async link(
    @Body() dto: LinkBranchQuoteDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { created, link } = await this.classification.linkBranchQuote(dto);
    const linked = link as { id: string };
    res.status(created ? HttpStatus.CREATED : HttpStatus.OK);
    if (created) res.header('Location', `/v1/admin/branch-quotes/${linked.id}`);
    return { data: link };
  }

  @Get()
  list(@Query() query: BranchQuotesAdminQueryDto) {
    return this.classification.listBranchQuotes(query);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSinLinkDto,
  ) {
    return this.classification.updateBranchLink(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  unlink(@Param('id', ParseUUIDPipe) id: string) {
    return this.classification.unlinkBranchQuote(id);
  }
}
