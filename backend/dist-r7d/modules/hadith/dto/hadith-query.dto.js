var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { HadithGrade } from '@prisma/client';
import { IsBoolean, IsEnum, IsIn, IsOptional, IsString, IsUUID, MaxLength, } from 'class-validator';
import { ToBoolean } from '../../../common/decorators/to-boolean.decorator.js';
import { TransformToArray } from '../../../common/decorators/transform-to-array.decorator.js';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto.js';
import { NotMawdu } from '../grade-policy.js';
export class HadithQueryDto extends PaginationQueryDto {
    lang = 'ar';
    collectionId;
    narrator;
    grades;
    includeWeak = false;
    q;
    reference;
}
__decorate([
    IsOptional(),
    IsIn(['ar', 'en']),
    __metadata("design:type", String)
], HadithQueryDto.prototype, "lang", void 0);
__decorate([
    IsOptional(),
    IsUUID(),
    __metadata("design:type", String)
], HadithQueryDto.prototype, "collectionId", void 0);
__decorate([
    IsOptional(),
    IsString(),
    MaxLength(200),
    __metadata("design:type", String)
], HadithQueryDto.prototype, "narrator", void 0);
__decorate([
    IsOptional(),
    TransformToArray(),
    IsEnum(HadithGrade, { each: true }),
    NotMawdu(),
    __metadata("design:type", Array)
], HadithQueryDto.prototype, "grades", void 0);
__decorate([
    IsOptional(),
    ToBoolean(),
    IsBoolean(),
    __metadata("design:type", Boolean)
], HadithQueryDto.prototype, "includeWeak", void 0);
__decorate([
    IsOptional(),
    IsString(),
    MaxLength(500),
    __metadata("design:type", String)
], HadithQueryDto.prototype, "q", void 0);
__decorate([
    IsOptional(),
    IsString(),
    MaxLength(200),
    __metadata("design:type", String)
], HadithQueryDto.prototype, "reference", void 0);
//# sourceMappingURL=hadith-query.dto.js.map