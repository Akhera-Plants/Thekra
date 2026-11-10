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
import { IsBoolean, IsOptional } from 'class-validator';
import { JwtAuthGuard, Roles, RolesGuard } from '../../common/guards/admin.guard.js';
import { setCreated } from '../../common/http/set-created.js';
import { ToBoolean } from '../../common/decorators/to-boolean.decorator.js';
import { CreateSinDto } from './dto/create-sin.dto.js';
import { SinsQueryDto } from './dto/sins-query.dto.js';
import { UpdateSinDto } from './dto/update-sin.dto.js';
import { SinsService } from './sins.service.js';
class DeleteSinQueryDto {
    force;
}
__decorate([
    IsOptional(),
    ToBoolean(),
    IsBoolean(),
    __metadata("design:type", Boolean)
], DeleteSinQueryDto.prototype, "force", void 0);
let SinsAdminController = class SinsAdminController {
    sinsService;
    constructor(sinsService) {
        this.sinsService = sinsService;
    }
    findAll(query) {
        return this.sinsService.adminList(query);
    }
    async create(dto, res) {
        const sin = await this.sinsService.adminCreate(dto);
        setCreated(res, `/v1/admin/sins/${sin.id}`);
        return { data: sin };
    }
    update(id, dto) {
        return this.sinsService.adminUpdate(id, dto);
    }
    remove(id, query) {
        return this.sinsService.adminDelete(id, query.force ?? false);
    }
};
__decorate([
    Get(),
    __param(0, Query()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [SinsQueryDto]),
    __metadata("design:returntype", void 0)
], SinsAdminController.prototype, "findAll", null);
__decorate([
    Post(),
    __param(0, Body()),
    __param(1, Res({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [CreateSinDto, Object]),
    __metadata("design:returntype", Promise)
], SinsAdminController.prototype, "create", null);
__decorate([
    Patch(':id'),
    __param(0, Param('id', ParseUUIDPipe)),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, UpdateSinDto]),
    __metadata("design:returntype", void 0)
], SinsAdminController.prototype, "update", null);
__decorate([
    Delete(':id'),
    HttpCode(HttpStatus.NO_CONTENT),
    __param(0, Param('id', ParseUUIDPipe)),
    __param(1, Query()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, DeleteSinQueryDto]),
    __metadata("design:returntype", void 0)
], SinsAdminController.prototype, "remove", null);
SinsAdminController = __decorate([
    UseGuards(JwtAuthGuard, RolesGuard),
    Roles('ADMIN'),
    Controller('admin/sins'),
    __metadata("design:paramtypes", [SinsService])
], SinsAdminController);
export { SinsAdminController };
//# sourceMappingURL=sins.admin.controller.js.map