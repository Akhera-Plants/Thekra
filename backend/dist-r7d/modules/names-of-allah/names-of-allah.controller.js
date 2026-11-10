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
import { PUBLIC_CACHE, PublicCache } from '../../common/http/public-cache.js';
import { NamesQueryDto } from './dto/names-query.dto.js';
import { NamesOfAllahService } from './names-of-allah.service.js';
let NamesOfAllahController = class NamesOfAllahController {
    names;
    constructor(names) {
        this.names = names;
    }
    findAll() {
        return this.names.findAll();
    }
    findOne(slug, query) {
        return this.names.findBySlug(slug, query.lang ?? 'ar');
    }
};
__decorate([
    Get(),
    PublicCache(PUBLIC_CACHE.content),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], NamesOfAllahController.prototype, "findAll", null);
__decorate([
    Get(':slug'),
    PublicCache(PUBLIC_CACHE.content),
    __param(0, Param('slug')),
    __param(1, Query()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, NamesQueryDto]),
    __metadata("design:returntype", void 0)
], NamesOfAllahController.prototype, "findOne", null);
NamesOfAllahController = __decorate([
    Controller('names-of-allah'),
    __metadata("design:paramtypes", [NamesOfAllahService])
], NamesOfAllahController);
export { NamesOfAllahController };
//# sourceMappingURL=names-of-allah.controller.js.map