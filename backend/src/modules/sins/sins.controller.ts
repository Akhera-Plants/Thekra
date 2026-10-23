import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { LocaleQueryDto } from '../../common/dto/locale-query.dto.js';
import { CurrentUser, type JwtPayload } from '../../common/decorators/current-user.decorator.js';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard.js';
import { FavoritesService } from '../favorites/favorites.service.js';
import { SinGoodDeedsQueryDto } from './dto/sin-good-deeds-query.dto.js';
import { SinQuotesQueryDto } from './dto/sin-quotes-query.dto.js';
import { SinsQueryDto } from './dto/sins-query.dto.js';
import { SinsService } from './sins.service.js';
import { PUBLIC_CACHE, PublicCache } from '../../common/http/public-cache.js';

@Controller('sins')
export class SinsController {
  constructor(
    private readonly sinsService: SinsService,
    private readonly favoritesService: FavoritesService,
  ) {}

  /** Phase 5: Cache-Control for the sins catalogue (small, rarely changes). */
  @Get()
  @PublicCache(PUBLIC_CACHE.content)
  findAll(@Query() query: SinsQueryDto) {
    return this.sinsService.findAll(query);
  }

  @Get(':slug')
  @PublicCache(PUBLIC_CACHE.content)
  findBySlug(
    @Param('slug') slug: string,
    @Query() query: LocaleQueryDto,
  ) {
    return this.sinsService.findBySlug(slug, query.lang ?? 'ar');
  }

  /** #3 GET /sins/:slug/quotes — optional auth for isFavorite enrichment */
  @Get(':slug/quotes')
  @PublicCache(PUBLIC_CACHE.content)
  @UseGuards(OptionalJwtAuthGuard)
  async findQuotes(
    @Param('slug') slug: string,
    @Query() query: SinQuotesQueryDto,
    @CurrentUser() user: JwtPayload | undefined,
  ) {
    const result = await this.sinsService.findQuotesForSin(slug, query);
    if (!user) return result;

    // Enrich items with isFavorite when a token is present.
    const favoriteIds = await this.favoritesService.listQuoteIds(user.sub);
    const idSet = new Set(favoriteIds);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const items = (result.data.items as any[]).map((item: { link: unknown; quote: { id: string } }) => ({
      ...item,
      quote: { ...item.quote, isFavorite: idSet.has(item.quote.id) },
    }));
    return { ...result, data: { ...result.data, items } };
  }

  @Get(':slug/good-deeds')
  @PublicCache(PUBLIC_CACHE.content)
  findGoodDeeds(
    @Param('slug') slug: string,
    @Query() query: SinGoodDeedsQueryDto,
  ) {
    return this.sinsService.findGoodDeedsForSin(
      slug,
      query.page ?? 1,
      query.limit ?? 20,
      query.lang ?? 'ar',
    );
  }
}
