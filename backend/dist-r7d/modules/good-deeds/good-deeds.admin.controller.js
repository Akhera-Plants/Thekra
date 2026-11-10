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
import { Body, Controller, Delete, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Res, UseGuards, } from '@nestjs/common';
import { JwtAuthGuard, Roles, RolesGuard } from '../../common/guards/admin.guard.js';
import { setCreated } from '../../common/http/set-created.js';
import { CreateGoodDeedDto } from './dto/create-good-deed.dto.js';
import { UpdateGoodDeedDto } from './dto/update-good-deed.dto.js';
import { GoodDeedsService } from './good-deeds.service.js';
let GoodDeedsAdminController = class GoodDeedsAdminController {
    goodDeedsService;
    constructor(goodDeedsService) {
        this.goodDeedsService = goodDeedsService;
    }
    async create(dto, res) {
        const deed = await this.goodDeedsService.adminCreate(dto);
        setCreated(res, `/v1/admin/good-deeds/${deed.id}`);
        return { data: deed };
    }
    update(id, dto) {
        return this.goodDeedsService.adminUpdate(id, dto);
    }
    remove(id) {
        return this.goodDeedsService.adminDelete(id);
    }
};
__decorate([
    Post(),
    __param(0, Body()),
    __param(1, Res({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [CreateGoodDeedDto, Object]),
    __metadata("design:returntype", Promise)
], GoodDeedsAdminController.prototype, "create", null);
__decorate([
    Patch(':id'),
    __param(0, Param('id', ParseUUIDPipe)),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, UpdateGoodDeedDto]),
    __metadata("design:returntype", void 0)
], GoodDeedsAdminController.prototype, "update", null);
__decorate([
    Delete(':id'),
    HttpCode(HttpStatus.NO_CONTENT),
    __param(0, Param('id', ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], GoodDeedsAdminController.prototype, "remove", null);
GoodDeedsAdminController = __decorate([
    UseGuards(JwtAuthGuard, RolesGuard),
    Roles('ADMIN'),
    Controller('admin/good-deeds'),
    __metadata("design:paramtypes", [GoodDeedsService])
], GoodDeedsAdminController);
export { GoodDeedsAdminController };
//# sourceMappingURL=good-deeds.admin.controller.js.map