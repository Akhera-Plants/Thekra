import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { CurrentUser, type JwtPayload } from '../../common/decorators/current-user.decorator.js';
import { setCreated } from '../../common/http/set-created.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { AddFavoriteDto } from './dto/add-favorite.dto.js';
import { FavoritesQueryDto } from './dto/favorites-query.dto.js';
import { FavoritesService } from './favorites.service.js';

@Controller('favorites')
@UseGuards(JwtAuthGuard)
export class FavoritesController {
  constructor(private readonly favoritesService: FavoritesService) {}

  /** #24 GET /v1/favorites */
  @Get()
  list(@CurrentUser() user: JwtPayload, @Query() query: FavoritesQueryDto) {
    return this.favoritesService.list(user.sub, query);
  }

  /** #25 GET /v1/favorites/quote-ids */
  @Get('quote-ids')
  async listQuoteIds(@CurrentUser() user: JwtPayload) {
    const ids = await this.favoritesService.listQuoteIds(user.sub);
    return { data: ids };
  }

  /** #26 POST /v1/favorites */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async add(
    @CurrentUser() user: JwtPayload,
    @Body() dto: AddFavoriteDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const fav = await this.favoritesService.add(user.sub, dto.quoteId);
    setCreated(res, `/v1/favorites/${dto.quoteId}`);
    return { data: fav };
  }

  /** #27 DELETE /v1/favorites/:quoteId */
  @Delete(':quoteId')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentUser() user: JwtPayload,
    @Param('quoteId', ParseUUIDPipe) quoteId: string,
  ) {
    return this.favoritesService.remove(user.sub, quoteId);
  }
}
