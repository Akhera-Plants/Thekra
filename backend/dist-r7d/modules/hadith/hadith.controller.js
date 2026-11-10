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
import { Controller, Get, Query } from '@nestjs/common';
import { HadithCollectionsQueryDto } from './dto/hadith-collections-query.dto.js';
import { HadithQueryDto } from './dto/hadith-query.dto.js';
import { HadithService } from './hadith.service.js';
import { PUBLIC_CACHE, PublicCache } from '../../common/http/public-cache.js';
let HadithController = class HadithController {
    hadithService;
    constructor(hadithService) {
        this.hadithService = hadithService;
    }
    listCollections(query) {
        return this.hadithService.listCollections(query);
    }
    findAll(query) {
        return this.hadithService.findAll(query);
    }
};
__decorate([
    Get('collections'),
    PublicCache(PUBLIC_CACHE.content),
    __param(0, Query()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [HadithCollectionsQueryDto]),
    __metadata("design:returntype", void 0)
], HadithController.prototype, "listCollections", null);
__decorate([
    Get(),
    PublicCache(PUBLIC_CACHE.content),
    __param(0, Query()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [HadithQueryDto]),
    __metadata("design:returntype", void 0)
], HadithController.prototype, "findAll", null);
HadithController = __decorate([
    Controller('hadith'),
    __metadata("design:paramtypes", [HadithService])
], HadithController);
export { HadithController };
//# sourceMappingURL=hadith.controller.js.map