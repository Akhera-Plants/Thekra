var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { LocaleQueryDto } from '../../common/dto/locale-query.dto.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard.js';
import { FavoritesService } from '../favorites/favorites.service.js';
import { GoodDeedQuotesQueryDto } from '../sins/dto/sin-quotes-query.dto.js';
import { GoodDeedsQueryDto } from './dto/good-deeds-query.dto.js';
import { GoodDeedsService } from './good-deeds.service.js';
import { PUBLIC_CACHE, PublicCache } from '../../common/http/public-cache.js';
let GoodDeedsController = class GoodDeedsController {
    goodDeedsService;
    favoritesService;
    constructor(goodDeedsService, favoritesService) {
        this.goodDeedsService = goodDeedsService;
        this.favoritesService = favoritesService;
    }
    findAll(query) {
        return this.goodDeedsService.findAll(query);
    }
    findBySlug(slug, query) {
        return this.goodDeedsService.findBySlug(slug, query.lang ?? 'ar');
    }
    async findQuotes(slug, query, user) {
        const result = await this.goodDeedsService.findQuotesForGoodDeed(slug, query);
        if (!user)
            return result;
        const favoriteIds = await this.favoritesService.listQuoteIds(user.sub);
        const idSet = new Set(favoriteIds);
        const items = result.data.items.map((item) => ({
            ...item,
            quote: { ...item.quote, isFavorite: idSet.has(item.quote.id) },
        }));
        return { ...result, data: { ...result.data, items } };
    }
};
__decorate([
    Get(),
    PublicCache(PUBLIC_CACHE.content),
    __param(0, Query()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [GoodDeedsQueryDto]),
    __metadata("design:returntype", void 0)
], GoodDeedsController.prototype, "findAll", null);
__decorate([
    Get(':slug'),
    PublicCache(PUBLIC_CACHE.content),
    __param(0, Param('slug')),
    __param(1, Query()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, LocaleQueryDto]),
    __metadata("design:returntype", void 0)
], GoodDeedsController.prototype, "findBySlug", null);
__decorate([
    Get(':slug/quotes'),
    PublicCache(PUBLIC_CACHE.content),
    UseGuards(OptionalJwtAuthGuard),
    __param(0, Param('slug')),
    __param(1, Query()),
    __param(2, CurrentUser()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, GoodDeedQuotesQueryDto, Object]),
    __metadata("design:returntype", Promise)
], GoodDeedsController.prototype, "findQuotes", null);
GoodDeedsController = __decorate([
    Controller('good-deeds'),
    __metadata("design:paramtypes", [GoodDeedsService,
        FavoritesService])
], GoodDeedsController);
export { GoodDeedsController };
//# sourceMappingURL=good-deeds.controller.js.map