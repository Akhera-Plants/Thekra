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
import { Controller, Get, Query } from '@nestjs/common';
import { PUBLIC_CACHE, PublicCache } from '../../common/http/public-cache.js';
import { PracticeEvidenceQueryDto } from './dto/practice-evidence-query.dto.js';
import { PracticeService } from './practice.service.js';
let PracticeController = class PracticeController {
    practiceService;
    constructor(practiceService) {
        this.practiceService = practiceService;
    }
    catalog() {
        return this.practiceService.catalog();
    }
    evidence(query) {
        return this.practiceService.evidence(query.ids, query.lang ?? 'ar');
    }
};
__decorate([
    Get('catalog'),
    PublicCache(PUBLIC_CACHE.reference),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], PracticeController.prototype, "catalog", null);
__decorate([
    Get('evidence'),
    PublicCache(PUBLIC_CACHE.quote),
    __param(0, Query()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [PracticeEvidenceQueryDto]),
    __metadata("design:returntype", void 0)
], PracticeController.prototype, "evidence", null);
PracticeController = __decorate([
    Controller('practice'),
    __metadata("design:paramtypes", [PracticeService])
], PracticeController);
export { PracticeController };
//# sourceMappingURL=practice.controller.js.map