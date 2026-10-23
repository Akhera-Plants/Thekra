import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { LocaleQueryDto } from '../../common/dto/locale-query.dto.js';
import { CurrentUser, type JwtPayload } from '../../common/decorators/current-user.decorator.js';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard.js';
import { FavoritesService } from '../favorites/favorites.service.js';
import { GoodDeedQuotesQueryDto } from '../sins/dto/sin-quotes-query.dto.js';
import { GoodDeedsQueryDto } from './dto/good-deeds-query.dto.js';
import { GoodDeedsService } from './good-deeds.service.js';
import { PUBLIC_CACHE, PublicCache } from '../../common/http/public-cache.js';

@Controller('good-deeds')
export class GoodDeedsController {
  constructor(
    private readonly goodDeedsService: GoodDeedsService,
    private readonly favoritesService: FavoritesService,
  ) {}

  @Get()
  @PublicCache(PUBLIC_CACHE.content)
  findAll(@Query() query: GoodDeedsQueryDto) {
    return this.goodDeedsService.findAll(query);
  }

  @Get(':slug')
  @PublicCache(PUBLIC_CACHE.content)
  findBySlug(
    @Param('slug') slug: string,
    @Query() query: LocaleQueryDto,
  ) {
    return this.goodDeedsService.findBySlug(slug, query.lang ?? 'ar');
  }

  /** #7 GET /good-deeds/:slug/quotes — optional auth for isFavorite enrichment */
  @Get(':slug/quotes')
  @PublicCache(PUBLIC_CACHE.content)
  @UseGuards(OptionalJwtAuthGuard)
  async findQuotes(
    @Param('slug') slug: string,
    @Query() query: GoodDeedQuotesQueryDto,
    @CurrentUser() user: JwtPayload | undefined,
  ) {
    const result = await this.goodDeedsService.findQuotesForGoodDeed(slug, query);
    if (!user) return result;

    const favoriteIds = await this.favoritesService.listQuoteIds(user.sub);
    const idSet = new Set(favoriteIds);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const items = (result.data.items as any[]).map((item: { link: unknown; quote: { id: string } }) => ({
      ...item,
      quote: { ...item.quote, isFavorite: idSet.has(item.quote.id) },
    }));
    return { ...result, data: { ...result.data, items } };
  }
}
