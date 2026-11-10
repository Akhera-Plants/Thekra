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
import { Controller, Get, Param, ParseIntPipe, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard.js';
import { FavoritesService } from '../favorites/favorites.service.js';
import { SinQuotesQueryDto } from '../sins/dto/sin-quotes-query.dto.js';
import { BranchesQueryDto } from './dto/branches-query.dto.js';
import { ImanBranchesService } from './iman-branches.service.js';
import { PUBLIC_CACHE, PublicCache } from '../../common/http/public-cache.js';
let ImanBranchesController = class ImanBranchesController {
    branches;
    favorites;
    constructor(branches, favorites) {
        this.branches = branches;
        this.favorites = favorites;
    }
    findAll(query) {
        return this.branches.findAll(query);
    }
    findOne(number, query) {
        return this.branches.findByNumber(number, query.lang ?? 'ar');
    }
    async findQuotes(number, query, user) {
        const result = await this.branches.findQuotesForBranch(number, query);
        if (!user)
            return result;
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
};
__decorate([
    Get(),
    PublicCache(PUBLIC_CACHE.content),
    __param(0, Query()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [BranchesQueryDto]),
    __metadata("design:returntype", void 0)
], ImanBranchesController.prototype, "findAll", null);
__decorate([
    Get(':number'),
    PublicCache(PUBLIC_CACHE.content),
    __param(0, Param('number', new ParseIntPipe({ errorHttpStatusCode: 400 }))),
    __param(1, Query()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, BranchesQueryDto]),
    __metadata("design:returntype", void 0)
], ImanBranchesController.prototype, "findOne", null);
__decorate([
    Get(':number/quotes'),
    PublicCache(PUBLIC_CACHE.content),
    UseGuards(OptionalJwtAuthGuard),
    __param(0, Param('number', new ParseIntPipe({ errorHttpStatusCode: 400 }))),
    __param(1, Query()),
    __param(2, CurrentUser()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, SinQuotesQueryDto, Object]),
    __metadata("design:returntype", Promise)
], ImanBranchesController.prototype, "findQuotes", null);
ImanBranchesController = __decorate([
    Controller('branches'),
    __metadata("design:paramtypes", [ImanBranchesService,
        FavoritesService])
], ImanBranchesController);
export { ImanBranchesController };
//# sourceMappingURL=iman-branches.controller.js.map