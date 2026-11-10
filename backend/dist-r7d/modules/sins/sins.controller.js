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
import { SinGoodDeedsQueryDto } from './dto/sin-good-deeds-query.dto.js';
import { SinQuotesQueryDto } from './dto/sin-quotes-query.dto.js';
import { SinsQueryDto } from './dto/sins-query.dto.js';
import { SinsService } from './sins.service.js';
import { PUBLIC_CACHE, PublicCache } from '../../common/http/public-cache.js';
let SinsController = class SinsController {
    sinsService;
    favoritesService;
    constructor(sinsService, favoritesService) {
        this.sinsService = sinsService;
        this.favoritesService = favoritesService;
    }
    findAll(query) {
        return this.sinsService.findAll(query);
    }
    findBySlug(slug, query) {
        return this.sinsService.findBySlug(slug, query.lang ?? 'ar');
    }
    async findQuotes(slug, query, user) {
        const result = await this.sinsService.findQuotesForSin(slug, query);
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
    findGoodDeeds(slug, query) {
        return this.sinsService.findGoodDeedsForSin(slug, query.page ?? 1, query.limit ?? 20, query.lang ?? 'ar');
    }
};
__decorate([
    Get(),
    PublicCache(PUBLIC_CACHE.content),
    __param(0, Query()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [SinsQueryDto]),
    __metadata("design:returntype", void 0)
], SinsController.prototype, "findAll", null);
__decorate([
    Get(':slug'),
    PublicCache(PUBLIC_CACHE.content),
    __param(0, Param('slug')),
    __param(1, Query()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, LocaleQueryDto]),
    __metadata("design:returntype", void 0)
], SinsController.prototype, "findBySlug", null);
__decorate([
    Get(':slug/quotes'),
    PublicCache(PUBLIC_CACHE.content),
    UseGuards(OptionalJwtAuthGuard),
    __param(0, Param('slug')),
    __param(1, Query()),
    __param(2, CurrentUser()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, SinQuotesQueryDto, Object]),
    __metadata("design:returntype", Promise)
], SinsController.prototype, "findQuotes", null);
__decorate([
    Get(':slug/good-deeds'),
    PublicCache(PUBLIC_CACHE.content),
    __param(0, Param('slug')),
    __param(1, Query()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, SinGoodDeedsQueryDto]),
    __metadata("design:returntype", void 0)
], SinsController.prototype, "findGoodDeeds", null);
SinsController = __decorate([
    Controller('sins'),
    __metadata("design:paramtypes", [SinsService,
        FavoritesService])
], SinsController);
export { SinsController };
//# sourceMappingURL=sins.controller.js.map