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
import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Query, Res, UseGuards, } from '@nestjs/common';
import { IsBoolean, IsOptional, IsUUID } from 'class-validator';
import { JwtAuthGuard, Roles, RolesGuard } from '../../common/guards/admin.guard.js';
import { setCreated } from '../../common/http/set-created.js';
import { ChapterMapsService } from './chapter-maps.service.js';
import { CreateChapterMapDto } from './dto/create-chapter-map.dto.js';
class ChapterMapListQueryDto {
    sourceId;
}
__decorate([
    IsOptional(),
    IsUUID(),
    __metadata("design:type", String)
], ChapterMapListQueryDto.prototype, "sourceId", void 0);
class UpdateChapterMapDto {
    reviewed;
}
__decorate([
    IsBoolean(),
    __metadata("design:type", Boolean)
], UpdateChapterMapDto.prototype, "reviewed", void 0);
let ChapterMapsAdminController = class ChapterMapsAdminController {
    maps;
    constructor(maps) {
        this.maps = maps;
    }
    async create(dto, res) {
        const result = await this.maps.create(dto);
        setCreated(res, `/v1/admin/chapter-maps/${result.data.id}`);
        return result;
    }
    list(query) {
        return this.maps.list(query.sourceId);
    }
    update(id, dto) {
        return this.maps.updateReviewed(id, dto.reviewed);
    }
    remove(id) {
        return this.maps.remove(id);
    }
};
__decorate([
    Post(),
    __param(0, Body()),
    __param(1, Res({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [CreateChapterMapDto, Object]),
    __metadata("design:returntype", Promise)
], ChapterMapsAdminController.prototype, "create", null);
__decorate([
    Get(),
    __param(0, Query()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [ChapterMapListQueryDto]),
    __metadata("design:returntype", void 0)
], ChapterMapsAdminController.prototype, "list", null);
__decorate([
    Patch(':id'),
    __param(0, Param('id', ParseUUIDPipe)),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, UpdateChapterMapDto]),
    __metadata("design:returntype", void 0)
], ChapterMapsAdminController.prototype, "update", null);
__decorate([
    Delete(':id'),
    HttpCode(HttpStatus.NO_CONTENT),
    __param(0, Param('id', ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], ChapterMapsAdminController.prototype, "remove", null);
ChapterMapsAdminController = __decorate([
    UseGuards(JwtAuthGuard, RolesGuard),
    Roles('ADMIN'),
    Controller('admin/chapter-maps'),
    __metadata("design:paramtypes", [ChapterMapsService])
], ChapterMapsAdminController);
export { ChapterMapsAdminController };
//# sourceMappingURL=chapter-maps.admin.controller.js.map