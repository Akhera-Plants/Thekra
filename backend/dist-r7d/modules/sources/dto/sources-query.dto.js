var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { SourceType } from '@prisma/client';
import { IsBoolean, IsEnum, IsIn, IsOptional, } from 'class-validator';
import { ToBoolean } from '../../../common/decorators/to-boolean.decorator.js';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto.js';
export class SourcesQueryDto extends PaginationQueryDto {
    lang = 'ar';
    type;
    isExternalApi;
}
__decorate([
    IsOptional(),
    IsIn(['ar', 'en']),
    __metadata("design:type", String)
], SourcesQueryDto.prototype, "lang", void 0);
__decorate([
    IsOptional(),
    IsEnum(SourceType),
    __metadata("design:type", String)
], SourcesQueryDto.prototype, "type", void 0);
__decorate([
    IsOptional(),
    ToBoolean(),
    IsBoolean(),
    __metadata("design:type", Boolean)
], SourcesQueryDto.prototype, "isExternalApi", void 0);
//# sourceMappingURL=sources-query.dto.js.map