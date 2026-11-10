var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { IsEnum, IsIn, IsOptional } from 'class-validator';
import { QuoteType } from '@prisma/client';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto.js';
export class FavoritesQueryDto extends PaginationQueryDto {
    lang = 'ar';
    type;
}
__decorate([
    IsOptional(),
    IsIn(['ar', 'en']),
    __metadata("design:type", String)
], FavoritesQueryDto.prototype, "lang", void 0);
__decorate([
    IsOptional(),
    IsEnum(QuoteType),
    __metadata("design:type", String)
], FavoritesQueryDto.prototype, "type", void 0);
//# sourceMappingURL=favorites-query.dto.js.map