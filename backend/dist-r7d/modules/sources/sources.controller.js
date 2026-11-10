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
import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { SourcesQueryDto } from './dto/sources-query.dto.js';
import { SourcesService } from './sources.service.js';
import { PUBLIC_CACHE, PublicCache } from '../../common/http/public-cache.js';
let SourcesController = class SourcesController {
    sourcesService;
    constructor(sourcesService) {
        this.sourcesService = sourcesService;
    }
    findAll(query) {
        return this.sourcesService.findAll(query);
    }
    findById(id) {
        return this.sourcesService.findById(id);
    }
};
__decorate([
    Get(),
    PublicCache(PUBLIC_CACHE.reference),
    __param(0, Query()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [SourcesQueryDto]),
    __metadata("design:returntype", void 0)
], SourcesController.prototype, "findAll", null);
__decorate([
    Get(':id'),
    PublicCache(PUBLIC_CACHE.reference),
    __param(0, Param('id', ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], SourcesController.prototype, "findById", null);
SourcesController = __decorate([
    Controller('sources'),
    __metadata("design:paramtypes", [SourcesService])
], SourcesController);
export { SourcesController };
//# sourceMappingURL=sources.controller.js.map