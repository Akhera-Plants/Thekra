var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { HadithGrade, QuoteType } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, } from 'class-validator';
import { ToBoolean } from '../../../common/decorators/to-boolean.decorator.js';
import { TransformToArray } from '../../../common/decorators/transform-to-array.decorator.js';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto.js';
import { NotMawdu } from '../../hadith/grade-policy.js';
import { THEME_KEY_PATTERN } from '../../taxonomy/topic-themes.js';
export class SinQuotesQueryDto extends PaginationQueryDto {
    limit = 10;
    lang = 'ar';
    type;
    kind;
    theme;
    grades;
    includeWeak = false;
    minScore;
    shuffle = false;
    seed;
}
__decorate([
    IsOptional(),
    Type(() => Number),
    IsInt(),
    Min(1),
    Max(50),
    __metadata("design:type", Number)
], SinQuotesQueryDto.prototype, "limit", void 0);
__decorate([
    IsOptional(),
    IsIn(['ar', 'en']),
    __metadata("design:type", String)
], SinQuotesQueryDto.prototype, "lang", void 0);
__decorate([
    IsOptional(),
    TransformToArray(),
    IsEnum(QuoteType, { each: true }),
    __metadata("design:type", Array)
], SinQuotesQueryDto.prototype, "type", void 0);
__decorate([
    IsOptional(),
    IsIn(['verse', 'hadith', 'athar']),
    __metadata("design:type", String)
], SinQuotesQueryDto.prototype, "kind", void 0);
__decorate([
    IsOptional(),
    IsString(),
    MaxLength(64),
    Matches(THEME_KEY_PATTERN),
    __metadata("design:type", String)
], SinQuotesQueryDto.prototype, "theme", void 0);
__decorate([
    IsOptional(),
    TransformToArray(),
    IsEnum(HadithGrade, { each: true }),
    NotMawdu(),
    __metadata("design:type", Array)
], SinQuotesQueryDto.prototype, "grades", void 0);
__decorate([
    IsOptional(),
    ToBoolean(),
    IsBoolean(),
    __metadata("design:type", Boolean)
], SinQuotesQueryDto.prototype, "includeWeak", void 0);
__decorate([
    IsOptional(),
    Type(() => Number),
    IsInt(),
    Min(0),
    Max(100),
    __metadata("design:type", Number)
], SinQuotesQueryDto.prototype, "minScore", void 0);
__decorate([
    IsOptional(),
    ToBoolean(),
    IsBoolean(),
    __metadata("design:type", Boolean)
], SinQuotesQueryDto.prototype, "shuffle", void 0);
__decorate([
    IsOptional(),
    IsString(),
    MaxLength(64),
    __metadata("design:type", String)
], SinQuotesQueryDto.prototype, "seed", void 0);
export { SinQuotesQueryDto as GoodDeedQuotesQueryDto };
//# sourceMappingURL=sin-quotes-query.dto.js.map