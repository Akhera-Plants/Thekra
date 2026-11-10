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
import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Query, Res, UseGuards, } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { setCreated } from '../../common/http/set-created.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { AddFavoriteDto } from './dto/add-favorite.dto.js';
import { FavoritesQueryDto } from './dto/favorites-query.dto.js';
import { FavoritesService } from './favorites.service.js';
let FavoritesController = class FavoritesController {
    favoritesService;
    constructor(favoritesService) {
        this.favoritesService = favoritesService;
    }
    list(user, query) {
        return this.favoritesService.list(user.sub, query);
    }
    async listQuoteIds(user) {
        const ids = await this.favoritesService.listQuoteIds(user.sub);
        return { data: ids };
    }
    async add(user, dto, res) {
        const fav = await this.favoritesService.add(user.sub, dto.quoteId);
        setCreated(res, `/v1/favorites/${dto.quoteId}`);
        return { data: fav };
    }
    remove(user, quoteId) {
        return this.favoritesService.remove(user.sub, quoteId);
    }
};
__decorate([
    Get(),
    __param(0, CurrentUser()),
    __param(1, Query()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, FavoritesQueryDto]),
    __metadata("design:returntype", void 0)
], FavoritesController.prototype, "list", null);
__decorate([
    Get('quote-ids'),
    __param(0, CurrentUser()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], FavoritesController.prototype, "listQuoteIds", null);
__decorate([
    Post(),
    HttpCode(HttpStatus.CREATED),
    __param(0, CurrentUser()),
    __param(1, Body()),
    __param(2, Res({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, AddFavoriteDto, Object]),
    __metadata("design:returntype", Promise)
], FavoritesController.prototype, "add", null);
__decorate([
    Delete(':quoteId'),
    HttpCode(HttpStatus.NO_CONTENT),
    __param(0, CurrentUser()),
    __param(1, Param('quoteId', ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], FavoritesController.prototype, "remove", null);
FavoritesController = __decorate([
    Controller('favorites'),
    UseGuards(JwtAuthGuard),
    __metadata("design:paramtypes", [FavoritesService])
], FavoritesController);
export { FavoritesController };
//# sourceMappingURL=favorites.controller.js.map