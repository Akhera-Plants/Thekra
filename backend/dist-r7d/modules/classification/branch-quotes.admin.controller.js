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
import { UpdateSinLinkDto } from './dto/update-sin-link.dto.js';
import { BranchQuotesAdminQueryDto } from './dto/branch-quotes-admin-query.dto.js';
import { LinkBranchQuoteDto } from './dto/link-branch-quote.dto.js';
import { ClassificationService } from './classification.service.js';
let BranchQuotesAdminController = class BranchQuotesAdminController {
    classification;
    constructor(classification) {
        this.classification = classification;
    }
    async link(dto, res) {
        const { created, link } = await this.classification.linkBranchQuote(dto);
        const linked = link;
        res.status(created ? HttpStatus.CREATED : HttpStatus.OK);
        if (created)
            res.header('Location', `/v1/admin/branch-quotes/${linked.id}`);
        return { data: link };
    }
    list(query) {
        return this.classification.listBranchQuotes(query);
    }
    update(id, dto) {
        return this.classification.updateBranchLink(id, dto);
    }
    unlink(id) {
        return this.classification.unlinkBranchQuote(id);
    }
};
__decorate([
    Post(),
    __param(0, Body()),
    __param(1, Res({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [LinkBranchQuoteDto, Object]),
    __metadata("design:returntype", Promise)
], BranchQuotesAdminController.prototype, "link", null);
__decorate([
    Get(),
    __param(0, Query()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [BranchQuotesAdminQueryDto]),
    __metadata("design:returntype", void 0)
], BranchQuotesAdminController.prototype, "list", null);
__decorate([
    Patch(':id'),
    __param(0, Param('id', ParseUUIDPipe)),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, UpdateSinLinkDto]),
    __metadata("design:returntype", void 0)
], BranchQuotesAdminController.prototype, "update", null);
__decorate([
    Delete(':id'),
    HttpCode(HttpStatus.NO_CONTENT),
    __param(0, Param('id', ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], BranchQuotesAdminController.prototype, "unlink", null);
BranchQuotesAdminController = __decorate([
    UseGuards(JwtAuthGuard, RolesGuard),
    Roles('ADMIN'),
    Controller('admin/branch-quotes'),
    __metadata("design:paramtypes", [ClassificationService])
], BranchQuotesAdminController);
export { BranchQuotesAdminController };
//# sourceMappingURL=branch-quotes.admin.controller.js.map