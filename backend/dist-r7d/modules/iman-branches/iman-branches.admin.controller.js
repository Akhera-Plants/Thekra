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
import { Body, Controller, Delete, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Put, Res, UseGuards, } from '@nestjs/common';
import { JwtAuthGuard, Roles, RolesGuard } from '../../common/guards/admin.guard.js';
import { setCreated } from '../../common/http/set-created.js';
import { CreateImanBranchDto } from './dto/create-iman-branch.dto.js';
import { ReplaceBranchPracticesDto } from './dto/replace-practices.dto.js';
import { UpdateImanBranchDto } from './dto/update-iman-branch.dto.js';
import { ImanBranchesService } from './iman-branches.service.js';
let ImanBranchesAdminController = class ImanBranchesAdminController {
    branches;
    constructor(branches) {
        this.branches = branches;
    }
    async create(dto, res) {
        const branch = await this.branches.adminCreate(dto);
        setCreated(res, `/v1/admin/branches/${branch.id}`);
        return { data: branch };
    }
    update(id, dto) {
        return this.branches.adminUpdate(id, dto).then((data) => ({ data }));
    }
    remove(id) {
        return this.branches.adminDelete(id);
    }
    replacePractices(id, dto) {
        return this.branches.replacePractices(id, dto);
    }
};
__decorate([
    Post(),
    __param(0, Body()),
    __param(1, Res({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [CreateImanBranchDto, Object]),
    __metadata("design:returntype", Promise)
], ImanBranchesAdminController.prototype, "create", null);
__decorate([
    Patch(':id'),
    __param(0, Param('id', ParseUUIDPipe)),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, UpdateImanBranchDto]),
    __metadata("design:returntype", void 0)
], ImanBranchesAdminController.prototype, "update", null);
__decorate([
    Delete(':id'),
    HttpCode(HttpStatus.NO_CONTENT),
    __param(0, Param('id', ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], ImanBranchesAdminController.prototype, "remove", null);
__decorate([
    Put(':id/practices'),
    __param(0, Param('id', ParseUUIDPipe)),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, ReplaceBranchPracticesDto]),
    __metadata("design:returntype", void 0)
], ImanBranchesAdminController.prototype, "replacePractices", null);
ImanBranchesAdminController = __decorate([
    UseGuards(JwtAuthGuard, RolesGuard),
    Roles('ADMIN'),
    Controller('admin/branches'),
    __metadata("design:paramtypes", [ImanBranchesService])
], ImanBranchesAdminController);
export { ImanBranchesAdminController };
//# sourceMappingURL=iman-branches.admin.controller.js.map