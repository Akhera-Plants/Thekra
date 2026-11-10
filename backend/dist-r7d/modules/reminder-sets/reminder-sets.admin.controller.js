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
import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Put, Res, UseGuards } from '@nestjs/common';
import { JwtAuthGuard, Roles, RolesGuard } from '../../common/guards/admin.guard.js';
import { setCreated } from '../../common/http/set-created.js';
import { CreateReminderSetDto, SetReminderSetItemsDto, UpdateReminderSetDto } from './dto/reminder-set.dto.js';
import { ReminderSetsService } from './reminder-sets.service.js';
let ReminderSetsAdminController = class ReminderSetsAdminController {
    service;
    constructor(service) {
        this.service = service;
    }
    findAll() {
        return this.service.adminList();
    }
    findOne(id) {
        return this.service.adminFind(id);
    }
    async create(dto, res) {
        const set = await this.service.adminCreate(dto);
        setCreated(res, `/v1/admin/reminder-sets/${set.id}`);
        return { data: set };
    }
    async update(id, dto) {
        return { data: await this.service.adminUpdate(id, dto) };
    }
    async setItems(id, dto) {
        return { data: await this.service.adminSetItems(id, dto.quoteIds) };
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
], ReminderSetsAdminController.prototype, "findAll", null);
__decorate([
    Get(':id'),
    __param(0, Param('id', ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], ReminderSetsAdminController.prototype, "findOne", null);
__decorate([
    Post(),
    __param(0, Body()),
    __param(1, Res({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [CreateReminderSetDto, Object]),
    __metadata("design:returntype", Promise)
], ReminderSetsAdminController.prototype, "create", null);
__decorate([
    Patch(':id'),
    __param(0, Param('id', ParseUUIDPipe)),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, UpdateReminderSetDto]),
    __metadata("design:returntype", Promise)
], ReminderSetsAdminController.prototype, "update", null);
__decorate([
    Put(':id/items'),
    __param(0, Param('id', ParseUUIDPipe)),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, SetReminderSetItemsDto]),
    __metadata("design:returntype", Promise)
], ReminderSetsAdminController.prototype, "setItems", null);
__decorate([
    Delete(':id'),
    HttpCode(HttpStatus.NO_CONTENT),
    __param(0, Param('id', ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], ReminderSetsAdminController.prototype, "remove", null);
ReminderSetsAdminController = __decorate([
    UseGuards(JwtAuthGuard, RolesGuard),
    Roles('ADMIN'),
    Controller('admin/reminder-sets'),
    __metadata("design:paramtypes", [ReminderSetsService])
], ReminderSetsAdminController);
export { ReminderSetsAdminController };
//# sourceMappingURL=reminder-sets.admin.controller.js.map