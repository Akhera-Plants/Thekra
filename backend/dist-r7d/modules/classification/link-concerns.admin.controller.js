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
import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard, Roles, RolesGuard } from '../../common/guards/admin.guard.js';
import { ClassificationService } from './classification.service.js';
import { LinkConcernsQueryDto } from './dto/link-concerns-query.dto.js';
let LinkConcernsAdminController = class LinkConcernsAdminController {
    classification;
    constructor(classification) {
        this.classification = classification;
    }
    list(query) {
        return this.classification.listLinkConcerns(query);
    }
};
__decorate([
    Get(),
    __param(0, Query()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [LinkConcernsQueryDto]),
    __metadata("design:returntype", void 0)
], LinkConcernsAdminController.prototype, "list", null);
LinkConcernsAdminController = __decorate([
    UseGuards(JwtAuthGuard, RolesGuard),
    Roles('ADMIN'),
    Controller('admin/link-concerns'),
    __metadata("design:paramtypes", [ClassificationService])
], LinkConcernsAdminController);
export { LinkConcernsAdminController };
//# sourceMappingURL=link-concerns.admin.controller.js.map