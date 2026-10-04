import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { QuoteDetailQueryDto } from './dto/quote-detail-query.dto.js';
import { QuotesQueryDto } from './dto/quotes-query.dto.js';
import { QuotesService } from './quotes.service.js';

@Controller('quotes')
export class QuotesController {
  constructor(private readonly quotesService: QuotesService) {}

  @Get()
  search(@Query() query: QuotesQueryDto) {
    return this.quotesService.search(query);
  }

  @Get(':id')
  findById(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: QuoteDetailQueryDto,
  ) {
    return this.quotesService.findById(id, query);
  }
}
