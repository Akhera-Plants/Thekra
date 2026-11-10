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
import { TagDetailQueryDto } from './dto/tag-detail-query.dto.js';
import { TagsQueryDto } from './dto/tags-query.dto.js';
import { TagsService } from './tags.service.js';
let TagsController = class TagsController {
    tagsService;
    constructor(tagsService) {
        this.tagsService = tagsService;
    }
    findAll(query) {
        return this.tagsService.findAll(query);
    }
    findBySlug(slug, query) {
        return this.tagsService.findBySlug(slug, query);
    }
};
__decorate([
    Get(),
    __param(0, Query()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [TagsQueryDto]),
    __metadata("design:returntype", void 0)
], TagsController.prototype, "findAll", null);
__decorate([
    Get(':slug'),
    __param(0, Param('slug')),
    __param(1, Query()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, TagDetailQueryDto]),
    __metadata("design:returntype", void 0)
], TagsController.prototype, "findBySlug", null);
TagsController = __decorate([
    Controller('tags'),
    __metadata("design:paramtypes", [TagsService])
], TagsController);
export { TagsController };
//# sourceMappingURL=tags.controller.js.map