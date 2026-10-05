import { Controller, Get, Header, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import { CurrentUser, type JwtPayload } from '../../common/decorators/current-user.decorator.js';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard.js';
import { FavoritesService } from '../favorites/favorites.service.js';
import { QuoteDetailQueryDto } from './dto/quote-detail-query.dto.js';
import { QuotesQueryDto } from './dto/quotes-query.dto.js';
import { QuotesService } from './quotes.service.js';

@Controller('quotes')
export class QuotesController {
  constructor(
    private readonly quotesService: QuotesService,
    private readonly favoritesService: FavoritesService,
  ) {}

  /** #8 GET /quotes — optional auth enriches isFavorite
   *  Phase 5: Cache-Control header for browse pages (short TTL since content changes). */
  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  @Header('Cache-Control', 'public, max-age=30, stale-while-revalidate=30')
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

  /** #9 GET /quotes/:id — optional auth enriches isFavorite */
  @Get(':id')
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
