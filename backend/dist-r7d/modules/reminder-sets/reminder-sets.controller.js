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
import { Controller, Get, Param, Query } from '@nestjs/common';
import { LocaleQueryDto } from '../../common/dto/locale-query.dto.js';
import { PUBLIC_CACHE, PublicCache } from '../../common/http/public-cache.js';
import { ReminderSetsService } from './reminder-sets.service.js';
let ReminderSetsController = class ReminderSetsController {
    service;
    constructor(service) {
        this.service = service;
    }
    findAll(query) {
        return this.service.findPublished(query.lang ?? 'ar');
    }
    findOne(slug, query) {
        return this.service.findPublishedBySlug(slug, query.lang ?? 'ar');
    }
};
__decorate([
    Get(),
    PublicCache(PUBLIC_CACHE.content),
    __param(0, Query()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [LocaleQueryDto]),
    __metadata("design:returntype", void 0)
], ReminderSetsController.prototype, "findAll", null);
__decorate([
    Get(':slug'),
    PublicCache(PUBLIC_CACHE.content),
    __param(0, Param('slug')),
    __param(1, Query()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, LocaleQueryDto]),
    __metadata("design:returntype", void 0)
], ReminderSetsController.prototype, "findOne", null);
ReminderSetsController = __decorate([
    Controller('reminder-sets'),
    __metadata("design:paramtypes", [ReminderSetsService])
], ReminderSetsController);
export { ReminderSetsController };
//# sourceMappingURL=reminder-sets.controller.js.map