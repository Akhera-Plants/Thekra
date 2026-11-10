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
import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { JwtAuthGuard, RolesGuard } from '../../common/guards/admin.guard.js';
import { ReviewFlagsQueryDto } from './dto/review-flags-query.dto.js';
import { ReviewNoteDto } from './dto/review-note.dto.js';
import { ReviewService } from './review.service.js';
let ReviewController = class ReviewController {
    review;
    constructor(review) {
        this.review = review;
    }
    listFlags(query) {
        return this.review.listFlags(query);
    }
    getFlag(id) {
        return this.review.getFlag(id);
    }
    confirmMatch(id, dto, user) {
        return this.review.confirmMatch(id, user.sub, dto.note);
    }
    rejectMatch(id, dto, user) {
        return this.review.rejectMatch(id, user.sub, dto.note);
    }
    resolve(id, dto, user) {
        return this.review.closeFlag(id, user.sub, 'RESOLVED', dto.note);
    }
    dismiss(id, dto, user) {
        return this.review.closeFlag(id, user.sub, 'DISMISSED', dto.note);
    }
};
__decorate([
    Get('flags'),
    __param(0, Query()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [ReviewFlagsQueryDto]),
    __metadata("design:returntype", void 0)
], ReviewController.prototype, "listFlags", null);
__decorate([
    Get('flags/:id'),
    __param(0, Param('id', ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], ReviewController.prototype, "getFlag", null);
__decorate([
    Post('matches/:id/confirm'),
    HttpCode(HttpStatus.OK),
    __param(0, Param('id', ParseUUIDPipe)),
    __param(1, Body()),
    __param(2, CurrentUser()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, ReviewNoteDto, Object]),
    __metadata("design:returntype", void 0)
], ReviewController.prototype, "confirmMatch", null);
__decorate([
    Post('matches/:id/reject'),
    HttpCode(HttpStatus.OK),
    __param(0, Param('id', ParseUUIDPipe)),
    __param(1, Body()),
    __param(2, CurrentUser()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, ReviewNoteDto, Object]),
    __metadata("design:returntype", void 0)
], ReviewController.prototype, "rejectMatch", null);
__decorate([
    Post('flags/:id/resolve'),
    HttpCode(HttpStatus.OK),
    __param(0, Param('id', ParseUUIDPipe)),
    __param(1, Body()),
    __param(2, CurrentUser()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, ReviewNoteDto, Object]),
    __metadata("design:returntype", void 0)
], ReviewController.prototype, "resolve", null);
__decorate([
    Post('flags/:id/dismiss'),
    HttpCode(HttpStatus.OK),
    __param(0, Param('id', ParseUUIDPipe)),
    __param(1, Body()),
    __param(2, CurrentUser()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, ReviewNoteDto, Object]),
    __metadata("design:returntype", void 0)
], ReviewController.prototype, "dismiss", null);
ReviewController = __decorate([
    Controller('review'),
    UseGuards(JwtAuthGuard, RolesGuard),
    Roles('ADMIN', 'REVIEWER'),
    __metadata("design:paramtypes", [ReviewService])
], ReviewController);
export { ReviewController };
//# sourceMappingURL=review.controller.js.map