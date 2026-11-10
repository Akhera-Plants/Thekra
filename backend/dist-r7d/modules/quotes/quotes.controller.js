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
import { Body, Controller, Get, HttpCode, HttpStatus, Ip, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
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
let QuotesController = class QuotesController {
    quotesService;
    favoritesService;
    reports;
    reader;
    constructor(quotesService, favoritesService, reports, reader) {
        this.quotesService = quotesService;
        this.favoritesService = favoritesService;
        this.reports = reports;
        this.reader = reader;
    }
    async search(query, user) {
        const result = await this.quotesService.search(query);
        if (!user)
            return result;
        const favoriteIds = await this.favoritesService.listQuoteIds(user.sub);
        const idSet = new Set(favoriteIds);
        const data = result.data.map((q) => ({
            ...q,
            isFavorite: idSet.has(q.id),
        }));
        return { ...result, data };
    }
    reminderOfTheDay(query) {
        return this.quotesService.reminderOfTheDay(query.lang ?? 'ar');
    }
    report(id, dto, user, ip) {
        return this.reports.report(id, dto.reason, dto.note, { userId: user?.sub, ip });
    }
    listExplanations(id, query) {
        return this.quotesService.listPublicExplanations(id, query.lang ?? 'ar');
    }
    readerContent(id, query) {
        return this.reader.read(id, query.lang ?? 'ar', query.linkId);
    }
    async findById(id, query, user) {
        const result = await this.quotesService.findById(id, query);
        if (!user)
            return result;
        const favoriteIds = await this.favoritesService.listQuoteIds(user.sub);
        return { ...result, isFavorite: favoriteIds.includes(id) };
    }
};
__decorate([
    Get(),
    PublicCache(PUBLIC_CACHE.search),
    UseGuards(OptionalJwtAuthGuard),
    __param(0, Query()),
    __param(1, CurrentUser()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [QuotesQueryDto, Object]),
    __metadata("design:returntype", Promise)
], QuotesController.prototype, "search", null);
__decorate([
    Get('today'),
    PublicCache(PUBLIC_CACHE.daily),
    __param(0, Query()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [QuoteDetailQueryDto]),
    __metadata("design:returntype", void 0)
], QuotesController.prototype, "reminderOfTheDay", null);
__decorate([
    Post(':id/reports'),
    HttpCode(HttpStatus.CREATED),
    Throttle({ default: { limit: 5, ttl: 60_000 } }),
    UseGuards(MaxBodyBytes(2048), OptionalJwtAuthGuard),
    __param(0, Param('id', ParseUUIDPipe)),
    __param(1, Body()),
    __param(2, CurrentUser()),
    __param(3, Ip()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, ReportQuoteDto, Object, Object]),
    __metadata("design:returntype", void 0)
], QuotesController.prototype, "report", null);
__decorate([
    Get(':id/explanations'),
    PublicCache(PUBLIC_CACHE.quote),
    __param(0, Param('id', ParseUUIDPipe)),
    __param(1, Query()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, QuoteDetailQueryDto]),
    __metadata("design:returntype", void 0)
], QuotesController.prototype, "listExplanations", null);
__decorate([
    Get(':id/reader'),
    PublicCache(PUBLIC_CACHE.quote),
    __param(0, Param('id', ParseUUIDPipe)),
    __param(1, Query()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, QuoteReaderQueryDto]),
    __metadata("design:returntype", void 0)
], QuotesController.prototype, "readerContent", null);
__decorate([
    Get(':id'),
    PublicCache(PUBLIC_CACHE.quote),
    UseGuards(OptionalJwtAuthGuard),
    __param(0, Param('id', ParseUUIDPipe)),
    __param(1, Query()),
    __param(2, CurrentUser()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, QuoteDetailQueryDto, Object]),
    __metadata("design:returntype", Promise)
], QuotesController.prototype, "findById", null);
QuotesController = __decorate([
    Controller('quotes'),
    __metadata("design:paramtypes", [QuotesService,
        FavoritesService,
        QuoteReportsService,
        QuoteReaderService])
], QuotesController);
export { QuotesController };
//# sourceMappingURL=quotes.controller.js.map