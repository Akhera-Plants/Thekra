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
import { ArrayMaxSize, ArrayUnique, IsArray, IsUUID } from 'class-validator';
import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Put, Query, Res, UseGuards, } from '@nestjs/common';
import { JwtAuthGuard, Roles, RolesGuard } from '../../common/guards/admin.guard.js';
import { setCreated } from '../../common/http/set-created.js';
import { LanguageCodePipe } from '../../common/pipes/language-code.pipe.js';
import { AdminQuotesQueryDto } from './dto/admin-quotes-query.dto.js';
import { CreateQuoteDto } from './dto/create-quote.dto.js';
import { CreateTranslationDto } from './dto/create-translation.dto.js';
import { SetTranslationDto } from './dto/set-translation.dto.js';
import { UpdateQuoteDto } from './dto/update-quote.dto.js';
import { QuotesService } from './quotes.service.js';
class SetTagsDto {
    tagIds;
}
__decorate([
    IsArray(),
    IsUUID('4', { each: true }),
    ArrayMaxSize(20),
    ArrayUnique(),
    __metadata("design:type", Array)
], SetTagsDto.prototype, "tagIds", void 0);
function mapTranslation(t) {
    return { id: t.id, languageCode: t.languageCode, text: t.text };
}
let QuotesAdminController = class QuotesAdminController {
    quotesService;
    constructor(quotesService) {
        this.quotesService = quotesService;
    }
    async create(dto, res) {
        const quote = await this.quotesService.adminCreate(dto);
        setCreated(res, `/v1/admin/quotes/${quote.id}`);
        return { data: quote };
    }
    findAll(query) {
        return this.quotesService.adminSearch(query);
    }
    markTextVerified(id) {
        return this.quotesService.markTextVerified(id);
    }
    update(id, dto) {
        return this.quotesService.adminUpdate(id, dto);
    }
    remove(id) {
        return this.quotesService.adminDelete(id);
    }
    async upsertTranslation(id, languageCode, body) {
        const t = await this.quotesService.upsertTranslation(id, languageCode, body.text);
        return mapTranslation(t);
    }
    async createTranslation(id, body, res) {
        const t = await this.quotesService.createTranslation(id, body.languageCode, body.text);
        setCreated(res, `/v1/admin/quotes/${id}/translations/${t.languageCode}`);
        return mapTranslation(t);
    }
    deleteTranslation(id, languageCode) {
        return this.quotesService.deleteTranslation(id, languageCode);
    }
    setTags(id, body) {
        return this.quotesService.setQuoteTags(id, body.tagIds);
    }
};
__decorate([
    Post(),
    __param(0, Body()),
    __param(1, Res({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [CreateQuoteDto, Object]),
    __metadata("design:returntype", Promise)
], QuotesAdminController.prototype, "create", null);
__decorate([
    Get(),
    __param(0, Query()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [AdminQuotesQueryDto]),
    __metadata("design:returntype", void 0)
], QuotesAdminController.prototype, "findAll", null);
__decorate([
    Post(':id/text-verification'),
    __param(0, Param('id', ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], QuotesAdminController.prototype, "markTextVerified", null);
__decorate([
    Patch(':id'),
    __param(0, Param('id', ParseUUIDPipe)),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, UpdateQuoteDto]),
    __metadata("design:returntype", void 0)
], QuotesAdminController.prototype, "update", null);
__decorate([
    Delete(':id'),
    HttpCode(HttpStatus.NO_CONTENT),
    __param(0, Param('id', ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], QuotesAdminController.prototype, "remove", null);
__decorate([
    Put(':id/translations/:languageCode'),
    __param(0, Param('id', ParseUUIDPipe)),
    __param(1, Param('languageCode', LanguageCodePipe)),
    __param(2, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, SetTranslationDto]),
    __metadata("design:returntype", Promise)
], QuotesAdminController.prototype, "upsertTranslation", null);
__decorate([
    Post(':id/translations'),
    __param(0, Param('id', ParseUUIDPipe)),
    __param(1, Body()),
    __param(2, Res({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, CreateTranslationDto, Object]),
    __metadata("design:returntype", Promise)
], QuotesAdminController.prototype, "createTranslation", null);
__decorate([
    Delete(':id/translations/:languageCode'),
    HttpCode(HttpStatus.NO_CONTENT),
    __param(0, Param('id', ParseUUIDPipe)),
    __param(1, Param('languageCode', LanguageCodePipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], QuotesAdminController.prototype, "deleteTranslation", null);
__decorate([
    Put(':id/tags'),
    __param(0, Param('id', ParseUUIDPipe)),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, SetTagsDto]),
    __metadata("design:returntype", void 0)
], QuotesAdminController.prototype, "setTags", null);
QuotesAdminController = __decorate([
    UseGuards(JwtAuthGuard, RolesGuard),
    Roles('ADMIN'),
    Controller('admin/quotes'),
    __metadata("design:paramtypes", [QuotesService])
], QuotesAdminController);
export { QuotesAdminController };
//# sourceMappingURL=quotes.admin.controller.js.map