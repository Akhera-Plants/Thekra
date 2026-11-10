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
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto.js';
export class SurahAyahsQueryDto extends PaginationQueryDto {
    lang = 'ar';
    fromAyah;
    toAyah;
}
__decorate([
    IsOptional(),
    IsIn(['ar', 'en']),
    __metadata("design:type", String)
], SurahAyahsQueryDto.prototype, "lang", void 0);
__decorate([
    IsOptional(),
    Type(() => Number),
    IsInt(),
    Min(1),
    Max(286),
    __metadata("design:type", Number)
], SurahAyahsQueryDto.prototype, "fromAyah", void 0);
__decorate([
    IsOptional(),
    Type(() => Number),
    IsInt(),
    Min(1),
    Max(286),
    __metadata("design:type", Number)
], SurahAyahsQueryDto.prototype, "toAyah", void 0);
//# sourceMappingURL=surah-ayahs-query.dto.js.map