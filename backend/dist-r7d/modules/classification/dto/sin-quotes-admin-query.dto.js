var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsIn, IsInt, IsOptional, IsUUID, Max, Min, } from 'class-validator';
import { ClassifiedBy, LinkReviewStatus } from '@prisma/client';
import { ToBoolean } from '../../../common/decorators/to-boolean.decorator.js';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto.js';
export class SinQuotesAdminQueryDto extends PaginationQueryDto {
    sinId;
    quoteId;
    minScore;
    maxScore;
    hasNote;
    sort;
    reviewStatus;
    classifiedBy;
}
__decorate([
    IsOptional(),
    IsUUID(),
    __metadata("design:type", String)
], SinQuotesAdminQueryDto.prototype, "sinId", void 0);
__decorate([
    IsOptional(),
    IsUUID(),
    __metadata("design:type", String)
], SinQuotesAdminQueryDto.prototype, "quoteId", void 0);
__decorate([
    IsOptional(),
    Type(() => Number),
    IsInt(),
    Min(0),
    Max(100),
    __metadata("design:type", Number)
], SinQuotesAdminQueryDto.prototype, "minScore", void 0);
__decorate([
    IsOptional(),
    Type(() => Number),
    IsInt(),
    Min(0),
    Max(100),
    __metadata("design:type", Number)
], SinQuotesAdminQueryDto.prototype, "maxScore", void 0);
__decorate([
    IsOptional(),
    ToBoolean(),
    IsBoolean(),
    __metadata("design:type", Boolean)
], SinQuotesAdminQueryDto.prototype, "hasNote", void 0);
__decorate([
    IsOptional(),
    IsIn(['score', 'newest']),
    __metadata("design:type", String)
], SinQuotesAdminQueryDto.prototype, "sort", void 0);
__decorate([
    IsOptional(),
    IsEnum(LinkReviewStatus),
    __metadata("design:type", String)
], SinQuotesAdminQueryDto.prototype, "reviewStatus", void 0);
__decorate([
    IsOptional(),
    IsEnum(ClassifiedBy),
    __metadata("design:type", String)
], SinQuotesAdminQueryDto.prototype, "classifiedBy", void 0);
//# sourceMappingURL=sin-quotes-admin-query.dto.js.map