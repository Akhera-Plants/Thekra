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
import { Body, Controller, Get, HttpCode, HttpStatus, NotFoundException, Param, ParseUUIDPipe, Post, Query, UseGuards, } from '@nestjs/common';
import { JwtAuthGuard, Roles, RolesGuard } from '../../common/guards/admin.guard.js';
import { ContentSyncService } from './content-sync.service.js';
import { SyncLogService } from './sync-log.service.js';
import { TriggerSyncDto } from './dto/trigger-sync.dto.js';
import { SyncLogsQueryDto } from './dto/sync-logs-query.dto.js';
let ContentSyncAdminController = class ContentSyncAdminController {
    contentSyncService;
    syncLogService;
    constructor(contentSyncService, syncLogService) {
        this.contentSyncService = contentSyncService;
        this.syncLogService = syncLogService;
    }
    async triggerRun(dto) {
        const result = await this.contentSyncService.triggerRun(dto);
        return { data: result };
    }
    async listRuns(query) {
        return this.syncLogService.findAll({
            sourceId: query.sourceId,
            status: query.status,
            from: query.from ? new Date(query.from) : undefined,
            to: query.to ? new Date(query.to) : undefined,
            page: query.page,
            limit: query.limit,
        });
    }
    async getRun(id) {
        const log = await this.syncLogService.findById(id);
        if (!log) {
            throw new NotFoundException({ code: 'RESOURCE_NOT_FOUND', message: 'SyncLog not found' });
        }
        return { data: log };
    }
};
__decorate([
    Post('content-sync/runs'),
    HttpCode(HttpStatus.ACCEPTED),
    __param(0, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [TriggerSyncDto]),
    __metadata("design:returntype", Promise)
], ContentSyncAdminController.prototype, "triggerRun", null);
__decorate([
    Get('sync-logs'),
    __param(0, Query()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [SyncLogsQueryDto]),
    __metadata("design:returntype", Promise)
], ContentSyncAdminController.prototype, "listRuns", null);
__decorate([
    Get('sync-logs/:id'),
    __param(0, Param('id', ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ContentSyncAdminController.prototype, "getRun", null);
ContentSyncAdminController = __decorate([
    UseGuards(JwtAuthGuard, RolesGuard),
    Roles('ADMIN'),
    Controller('admin'),
    __metadata("design:paramtypes", [ContentSyncService,
        SyncLogService])
], ContentSyncAdminController);
export { ContentSyncAdminController };
//# sourceMappingURL=content-sync.admin.controller.js.map