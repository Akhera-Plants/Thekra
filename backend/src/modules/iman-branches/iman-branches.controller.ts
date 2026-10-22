import { Controller, Get, Header, Param, ParseIntPipe, Query, UseGuards } from '@nestjs/common';
import { CurrentUser, type JwtPayload } from '../../common/decorators/current-user.decorator.js';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard.js';
import { FavoritesService } from '../favorites/favorites.service.js';
import { SinQuotesQueryDto } from '../sins/dto/sin-quotes-query.dto.js';
import { BranchesQueryDto } from './dto/branches-query.dto.js';
import { ImanBranchesService } from './iman-branches.service.js';

@Controller('branches')
export class ImanBranchesController {
  constructor(
    private readonly branches: ImanBranchesService,
    private readonly favorites: FavoritesService,
  ) {}

  @Get()
  @Header('Cache-Control', 'public, max-age=60, stale-while-revalidate=30')
  findAll(@Query() query: BranchesQueryDto) {
    return this.branches.findAll(query);
  }

  @Get(':number')
  findOne(
    @Param('number', new ParseIntPipe({ errorHttpStatusCode: 400 })) number: number,
    @Query() query: BranchesQueryDto,
  ) {
    return this.branches.findByNumber(number, query.lang ?? 'ar');
  }

  @Get(':number/quotes')
  @UseGuards(OptionalJwtAuthGuard)
  async findQuotes(
    @Param('number', new ParseIntPipe({ errorHttpStatusCode: 400 })) number: number,
    @Query() query: SinQuotesQueryDto,
    @CurrentUser() user: JwtPayload | undefined,
  ) {
    const result = await this.branches.findQuotesForBranch(number, query);
    if (!user) return result;
    const favoriteIds = new Set(await this.favorites.listQuoteIds(user.sub));
    return {
      ...result,
      data: {
        ...result.data,
        items: result.data.items.map((item) => ({
          ...item,
          quote: { ...item.quote, isFavorite: favoriteIds.has(item.quote.id) },
        })),
      },
    };
  }
}
