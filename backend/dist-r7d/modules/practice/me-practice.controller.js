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
import { Body, Controller, Get, Header, HttpCode, HttpStatus, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { PRIVATE_CACHE_HEADER } from '../../common/http/public-cache.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { PracticeChangesQueryDto } from './dto/practice-changes-query.dto.js';
import { PracticeSyncService } from './practice-sync.service.js';
let MePracticeController = class MePracticeController {
    practiceSync;
    constructor(practiceSync) {
        this.practiceSync = practiceSync;
    }
    changes(user, query) {
        return this.practiceSync.changes(user.sub, query.since ? new Date(query.since) : null);
    }
    sync(user, body) {
        return this.practiceSync.sync(user.sub, body);
    }
};
__decorate([
    Get(),
    Header('Cache-Control', PRIVATE_CACHE_HEADER),
    __param(0, CurrentUser()),
    __param(1, Query()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, PracticeChangesQueryDto]),
    __metadata("design:returntype", void 0)
], MePracticeController.prototype, "changes", null);
__decorate([
    Post('sync'),
    HttpCode(HttpStatus.OK),
    Header('Cache-Control', PRIVATE_CACHE_HEADER),
    __param(0, CurrentUser()),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], MePracticeController.prototype, "sync", null);
MePracticeController = __decorate([
    Controller('me/practice'),
    UseGuards(JwtAuthGuard),
    __metadata("design:paramtypes", [PracticeSyncService])
], MePracticeController);
export { MePracticeController };
//# sourceMappingURL=me-practice.controller.js.map