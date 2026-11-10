var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { HadithGrade, QuoteOrigin, QuoteType } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, } from 'class-validator';
import { ToBoolean } from '../../../common/decorators/to-boolean.decorator.js';
import { TransformToArray } from '../../../common/decorators/transform-to-array.decorator.js';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto.js';
import { NotMawdu } from '../../hadith/grade-policy.js';
export class QuotesQueryDto extends PaginationQueryDto {
    lang = 'ar';
    q;
    type;
    origin;
    grades;
    includeWeak;
    sourceId;
    tag;
    sinSlug;
    goodDeedSlug;
    surahNumber;
    ayahNumber;
    hasTranslation;
    sort;
}
__decorate([
    IsOptional(),
    IsIn(['ar', 'en']),
    __metadata("design:type", String)
], QuotesQueryDto.prototype, "lang", void 0);
__decorate([
    IsOptional(),
    IsString(),
    MaxLength(500),
    __metadata("design:type", String)
], QuotesQueryDto.prototype, "q", void 0);
__decorate([
    IsOptional(),
    TransformToArray(),
    IsEnum(QuoteType, { each: true }),
    __metadata("design:type", Array)
], QuotesQueryDto.prototype, "type", void 0);
__decorate([
    IsOptional(),
    IsEnum(QuoteOrigin),
    __metadata("design:type", String)
], QuotesQueryDto.prototype, "origin", void 0);
__decorate([
    IsOptional(),
    TransformToArray(),
    IsEnum(HadithGrade, { each: true }),
    NotMawdu(),
    __metadata("design:type", Array)
], QuotesQueryDto.prototype, "grades", void 0);
__decorate([
    IsOptional(),
    ToBoolean(),
    IsBoolean(),
    __metadata("design:type", Boolean)
], QuotesQueryDto.prototype, "includeWeak", void 0);
__decorate([
    IsOptional(),
    IsUUID(),
    __metadata("design:type", String)
], QuotesQueryDto.prototype, "sourceId", void 0);
__decorate([
    IsOptional(),
    TransformToArray(),
    IsString({ each: true }),
    __metadata("design:type", Array)
], QuotesQueryDto.prototype, "tag", void 0);
__decorate([
    IsOptional(),
    IsString(),
    MaxLength(100),
    __metadata("design:type", String)
], QuotesQueryDto.prototype, "sinSlug", void 0);
__decorate([
    IsOptional(),
    IsString(),
    MaxLength(100),
    __metadata("design:type", String)
], QuotesQueryDto.prototype, "goodDeedSlug", void 0);
__decorate([
    IsOptional(),
    Type(() => Number),
    IsInt(),
    Min(1),
    Max(114),
    __metadata("design:type", Number)
], QuotesQueryDto.prototype, "surahNumber", void 0);
__decorate([
    IsOptional(),
    Type(() => Number),
    IsInt(),
    Min(1),
    Max(286),
    __metadata("design:type", Number)
], QuotesQueryDto.prototype, "ayahNumber", void 0);
__decorate([
    IsOptional(),
    IsString(),
    MaxLength(16),
    __metadata("design:type", String)
], QuotesQueryDto.prototype, "hasTranslation", void 0);
__decorate([
    IsOptional(),
    IsIn(['relevance', 'newest', 'oldest']),
    __metadata("design:type", String)
], QuotesQueryDto.prototype, "sort", void 0);
//# sourceMappingURL=quotes-query.dto.js.map