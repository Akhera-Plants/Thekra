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
import { CreateSourceDto } from './dto/create-source.dto.js';
import { UpdateSourceDto } from './dto/update-source.dto.js';
import { SourcesService } from './sources.service.js';
let SourcesAdminController = class SourcesAdminController {
    sourcesService;
    constructor(sourcesService) {
        this.sourcesService = sourcesService;
    }
    async create(dto, res) {
        const source = await this.sourcesService.adminCreate(dto);
        setCreated(res, `/v1/admin/sources/${source.id}`);
        return { data: source };
    }
    update(id, dto) {
        return this.sourcesService.adminUpdate(id, dto);
    }
    remove(id) {
        return this.sourcesService.adminDelete(id);
    }
};
__decorate([
    Post(),
    __param(0, Body()),
    __param(1, Res({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [CreateSourceDto, Object]),
    __metadata("design:returntype", Promise)
], SourcesAdminController.prototype, "create", null);
__decorate([
    Patch(':id'),
    __param(0, Param('id', ParseUUIDPipe)),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, UpdateSourceDto]),
    __metadata("design:returntype", void 0)
], SourcesAdminController.prototype, "update", null);
__decorate([
    Delete(':id'),
    HttpCode(HttpStatus.NO_CONTENT),
    __param(0, Param('id', ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], SourcesAdminController.prototype, "remove", null);
SourcesAdminController = __decorate([
    UseGuards(JwtAuthGuard, RolesGuard),
    Roles('ADMIN'),
    Controller('admin/sources'),
    __metadata("design:paramtypes", [SourcesService])
], SourcesAdminController);
export { SourcesAdminController };
//# sourceMappingURL=sources.admin.controller.js.map