import { Body, Controller, Get, HttpCode, HttpStatus, Ip, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser, type JwtPayload } from '../../common/decorators/current-user.decorator.js';
import { MaxBodyBytes } from '../../common/guards/max-body-bytes.guard.js';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard.js';
import { FavoritesService } from '../favorites/favorites.service.js';
import { QuoteDetailQueryDto } from './dto/quote-detail-query.dto.js';
import { ReportQuoteDto } from './dto/report-quote.dto.js';
import { QuotesQueryDto } from './dto/quotes-query.dto.js';
import { QuoteReaderQueryDto } from './dto/quote-reader-query.dto.js';
import { QuoteReaderService } from './quote-reader.service.js';
import { QuoteReportsService } from './quote-reports.service.js';
import { QuotesService } from './quotes.service.js';
import { PUBLIC_CACHE, PublicCache } from '../../common/http/public-cache.js';

@Controller('quotes')
export class QuotesController {
  constructor(
    private readonly quotesService: QuotesService,
    private readonly favoritesService: FavoritesService,
    private readonly reports: QuoteReportsService,
    private readonly reader: QuoteReaderService,
  ) {}

  /** #8 GET /quotes — optional auth enriches isFavorite
   *  Phase 5: Cache-Control header for browse pages (short TTL since content changes). */
  @Get()
  @PublicCache(PUBLIC_CACHE.search)
  @UseGuards(OptionalJwtAuthGuard)
  async search(
    @Query() query: QuotesQueryDto,
    @CurrentUser() user: JwtPayload | undefined,
  ) {
    const result = await this.quotesService.search(query);
    if (!user) return result;

    const favoriteIds = await this.favoritesService.listQuoteIds(user.sub);
    const idSet = new Set(favoriteIds);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = (result.data as any[]).map((q: { id: string }) => ({
      ...q,
      isFavorite: idSet.has(q.id),
    }));
    return { ...result, data };
  }

  /** One published sahih or hasan text, the same one for everyone on a given UTC day. */
  @Get('today')
  @PublicCache(PUBLIC_CACHE.daily)
  reminderOfTheDay(@Query() query: QuoteDetailQueryDto) {
    return this.quotesService.reminderOfTheDay(query.lang ?? 'ar');
  }

  /**
   * Mistake report. No login needed; a token, when sent, makes the limits count per account. Abuse limits
   * (round 6, C-01s): 5 a minute per address here, a 2 KB body, and in QuoteReportsService per-reporter hour/day
   * limits, a 24 h dedupe and a global daily cap. The address is never stored, only a keyed hash with the day.
   */
  @Post(':id/reports')
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @UseGuards(MaxBodyBytes(2048), OptionalJwtAuthGuard)
  report(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReportQuoteDto,
    @CurrentUser() user: JwtPayload | undefined,
    @Ip() ip: string | undefined,
  ) {
    return this.reports.report(id, dto.reason, dto.note, { userId: user?.sub, ip });
  }

  /** Explanations for a quote. MAWDU quotes stay 404. */
  @Get(':id/explanations')
  @PublicCache(PUBLIC_CACHE.quote)
  listExplanations(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: QuoteDetailQueryDto,
  ) {
    return this.quotesService.listPublicExplanations(id, query.lang ?? 'ar');
  }

  /**
   * The reader (round 6, C-13): for a verse the three tafsirs inline (المختصر، السعدي، ابن عاشور), for a hadith its
   * sharh / fawaid, and the «وجه التذكير» of the link it was opened from (`linkId`) when one is written.
   */
  @Get(':id/reader')
  @PublicCache(PUBLIC_CACHE.quote)
  readerContent(@Param('id', ParseUUIDPipe) id: string, @Query() query: QuoteReaderQueryDto) {
    return this.reader.read(id, query.lang ?? 'ar', query.linkId);
  }

  /** #9 GET /quotes/:id — optional auth enriches isFavorite */
  @Get(':id')
  @PublicCache(PUBLIC_CACHE.quote)
  @UseGuards(OptionalJwtAuthGuard)
  async findById(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: QuoteDetailQueryDto,
    @CurrentUser() user: JwtPayload | undefined,
  ) {
    const result = await this.quotesService.findById(id, query);
    if (!user) return result;

    const favoriteIds = await this.favoritesService.listQuoteIds(user.sub);
    // result is a QuoteDto directly (not wrapped); spread and add isFavorite
    return { ...result, isFavorite: favoriteIds.includes(id) };
  }
}
