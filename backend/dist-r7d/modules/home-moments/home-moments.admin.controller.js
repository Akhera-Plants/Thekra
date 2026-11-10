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
import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Res, UseGuards } from '@nestjs/common';
import { JwtAuthGuard, Roles, RolesGuard } from '../../common/guards/admin.guard.js';
import { setCreated } from '../../common/http/set-created.js';
import { CreateHomeMomentDto, UpdateHomeMomentDto } from './dto/home-moment.dto.js';
import { HomeMomentsService } from './home-moments.service.js';
let HomeMomentsAdminController = class HomeMomentsAdminController {
    service;
    constructor(service) {
        this.service = service;
    }
    findAll() {
        return this.service.adminList();
    }
    async create(dto, res) {
        const moment = await this.service.adminCreate(dto);
        setCreated(res, `/v1/admin/home-moments/${moment.id}`);
        return { data: moment };
    }
    async update(id, dto) {
        return { data: await this.service.adminUpdate(id, dto) };
    }
    remove(id) {
        return this.service.adminDelete(id);
    }
};
__decorate([
    Get(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], HomeMomentsAdminController.prototype, "findAll", null);
__decorate([
    Post(),
    __param(0, Body()),
    __param(1, Res({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [CreateHomeMomentDto, Object]),
    __metadata("design:returntype", Promise)
], HomeMomentsAdminController.prototype, "create", null);
__decorate([
    Patch(':id'),
    __param(0, Param('id', ParseUUIDPipe)),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, UpdateHomeMomentDto]),
    __metadata("design:returntype", Promise)
], HomeMomentsAdminController.prototype, "update", null);
__decorate([
    Delete(':id'),
    HttpCode(HttpStatus.NO_CONTENT),
    __param(0, Param('id', ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], HomeMomentsAdminController.prototype, "remove", null);
HomeMomentsAdminController = __decorate([
    UseGuards(JwtAuthGuard, RolesGuard),
    Roles('ADMIN'),
    Controller('admin/home-moments'),
    __metadata("design:paramtypes", [HomeMomentsService])
], HomeMomentsAdminController);
export { HomeMomentsAdminController };
//# sourceMappingURL=home-moments.admin.controller.js.map