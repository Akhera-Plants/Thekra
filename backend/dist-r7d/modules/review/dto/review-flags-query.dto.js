var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { FlagSeverity, FlagStatus, FlagType } from '@prisma/client';
import { IsEnum, IsIn, IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto.js';
export class ReviewFlagsQueryDto extends PaginationQueryDto {
    lang = 'ar';
    type;
    severity;
    status;
    sourceId;
}
__decorate([
    IsOptional(),
    IsIn(['ar', 'en']),
    __metadata("design:type", String)
], ReviewFlagsQueryDto.prototype, "lang", void 0);
__decorate([
    IsOptional(),
    IsEnum(FlagType),
    __metadata("design:type", String)
], ReviewFlagsQueryDto.prototype, "type", void 0);
__decorate([
    IsOptional(),
    IsEnum(FlagSeverity),
    __metadata("design:type", String)
], ReviewFlagsQueryDto.prototype, "severity", void 0);
__decorate([
    IsOptional(),
    IsEnum(FlagStatus),
    __metadata("design:type", String)
], ReviewFlagsQueryDto.prototype, "status", void 0);
__decorate([
    IsOptional(),
    IsUUID(),
    __metadata("design:type", String)
], ReviewFlagsQueryDto.prototype, "sourceId", void 0);
//# sourceMappingURL=review-flags-query.dto.js.map