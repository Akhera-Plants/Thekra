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
import { JwtAuthGuard, Roles, RolesGuard } from '../../common/guards/admin.guard.js';
import { ClassificationService } from './classification.service.js';
import { BulkLinkGoodDeedQuotesDto } from './dto/bulk-link-good-deed-quotes.dto.js';
import { BulkLinkSinQuotesDto } from './dto/bulk-link-sin-quotes.dto.js';
import { GoodDeedQuotesAdminQueryDto } from './dto/good-deed-quotes-admin-query.dto.js';
import { LinkGoodDeedQuoteDto } from './dto/link-good-deed-quote.dto.js';
import { LinkSinQuoteDto } from './dto/link-sin-quote.dto.js';
import { RevokeGoodDeedGroupDto, RevokeSinGroupDto } from './dto/revoke-link-group.dto.js';
import { SinQuotesAdminQueryDto } from './dto/sin-quotes-admin-query.dto.js';
import { UpdateGoodDeedLinkDto } from './dto/update-good-deed-link.dto.js';
import { UpdateSinLinkDto } from './dto/update-sin-link.dto.js';
let SinQuotesAdminController = class SinQuotesAdminController {
    classificationService;
    constructor(classificationService) {
        this.classificationService = classificationService;
    }
    async linkSinQuote(dto, res) {
        const { created, link } = await this.classificationService.linkSinQuote(dto);
        if (created) {
            res.status(HttpStatus.CREATED);
            res.header('Location', `/v1/admin/sin-quotes/${link.id}`);
        }
        else {
            res.status(HttpStatus.OK);
        }
        return { data: link };
    }
    listSinQuotes(query) {
        return this.classificationService.listSinQuotes(query);
    }
    updateSinLink(id, dto) {
        return this.classificationService.updateSinLink(id, dto);
    }
    unlinkSinQuote(id) {
        return this.classificationService.unlinkSinQuote(id);
    }
    bulkLinkSinQuotes(dto) {
        return this.classificationService.bulkLinkSinQuotes(dto);
    }
    revokeSinGroup(dto) {
        return this.classificationService.revokeSinGroup(dto.sinId, dto.classifiedBy);
    }
};
__decorate([
    Post(),
    __param(0, Body()),
    __param(1, Res({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [LinkSinQuoteDto, Object]),
    __metadata("design:returntype", Promise)
], SinQuotesAdminController.prototype, "linkSinQuote", null);
__decorate([
    Get(),
    __param(0, Query()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [SinQuotesAdminQueryDto]),
    __metadata("design:returntype", void 0)
], SinQuotesAdminController.prototype, "listSinQuotes", null);
__decorate([
    Patch(':id'),
    __param(0, Param('id', ParseUUIDPipe)),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, UpdateSinLinkDto]),
    __metadata("design:returntype", void 0)
], SinQuotesAdminController.prototype, "updateSinLink", null);
__decorate([
    Delete(':id'),
    HttpCode(HttpStatus.NO_CONTENT),
    __param(0, Param('id', ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], SinQuotesAdminController.prototype, "unlinkSinQuote", null);
__decorate([
    Post('bulk'),
    HttpCode(HttpStatus.OK),
    __param(0, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [BulkLinkSinQuotesDto]),
    __metadata("design:returntype", void 0)
], SinQuotesAdminController.prototype, "bulkLinkSinQuotes", null);
__decorate([
    Post('revoke'),
    HttpCode(HttpStatus.OK),
    __param(0, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [RevokeSinGroupDto]),
    __metadata("design:returntype", void 0)
], SinQuotesAdminController.prototype, "revokeSinGroup", null);
SinQuotesAdminController = __decorate([
    UseGuards(JwtAuthGuard, RolesGuard),
    Roles('ADMIN'),
    Controller('admin/sin-quotes'),
    __metadata("design:paramtypes", [ClassificationService])
], SinQuotesAdminController);
export { SinQuotesAdminController };
let GoodDeedQuotesAdminController = class GoodDeedQuotesAdminController {
    classificationService;
    constructor(classificationService) {
        this.classificationService = classificationService;
    }
    async linkGoodDeedQuote(dto, res) {
        const { created, link } = await this.classificationService.linkGoodDeedQuote(dto);
        if (created) {
            res.status(HttpStatus.CREATED);
            res.header('Location', `/v1/admin/good-deed-quotes/${link.id}`);
        }
        else {
            res.status(HttpStatus.OK);
        }
        return { data: link };
    }
    listGoodDeedQuotes(query) {
        return this.classificationService.listGoodDeedQuotes(query);
    }
    updateGoodDeedLink(id, dto) {
        return this.classificationService.updateGoodDeedLink(id, dto);
    }
    unlinkGoodDeedQuote(id) {
        return this.classificationService.unlinkGoodDeedQuote(id);
    }
    bulkLinkGoodDeedQuotes(dto) {
        return this.classificationService.bulkLinkGoodDeedQuotes(dto);
    }
    revokeGoodDeedGroup(dto) {
        return this.classificationService.revokeGoodDeedGroup(dto.goodDeedId, dto.classifiedBy);
    }
};
__decorate([
    Post(),
    __param(0, Body()),
    __param(1, Res({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [LinkGoodDeedQuoteDto, Object]),
    __metadata("design:returntype", Promise)
], GoodDeedQuotesAdminController.prototype, "linkGoodDeedQuote", null);
__decorate([
    Get(),
    __param(0, Query()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [GoodDeedQuotesAdminQueryDto]),
    __metadata("design:returntype", void 0)
], GoodDeedQuotesAdminController.prototype, "listGoodDeedQuotes", null);
__decorate([
    Patch(':id'),
    __param(0, Param('id', ParseUUIDPipe)),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, UpdateGoodDeedLinkDto]),
    __metadata("design:returntype", void 0)
], GoodDeedQuotesAdminController.prototype, "updateGoodDeedLink", null);
__decorate([
    Delete(':id'),
    HttpCode(HttpStatus.NO_CONTENT),
    __param(0, Param('id', ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], GoodDeedQuotesAdminController.prototype, "unlinkGoodDeedQuote", null);
__decorate([
    Post('bulk'),
    HttpCode(HttpStatus.OK),
    __param(0, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [BulkLinkGoodDeedQuotesDto]),
    __metadata("design:returntype", void 0)
], GoodDeedQuotesAdminController.prototype, "bulkLinkGoodDeedQuotes", null);
__decorate([
    Post('revoke'),
    HttpCode(HttpStatus.OK),
    __param(0, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [RevokeGoodDeedGroupDto]),
    __metadata("design:returntype", void 0)
], GoodDeedQuotesAdminController.prototype, "revokeGoodDeedGroup", null);
GoodDeedQuotesAdminController = __decorate([
    UseGuards(JwtAuthGuard, RolesGuard),
    Roles('ADMIN'),
    Controller('admin/good-deed-quotes'),
    __metadata("design:paramtypes", [ClassificationService])
], GoodDeedQuotesAdminController);
export { GoodDeedQuotesAdminController };
//# sourceMappingURL=classification.admin.controller.js.map