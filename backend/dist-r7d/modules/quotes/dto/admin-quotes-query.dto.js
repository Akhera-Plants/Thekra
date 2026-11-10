var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { TextSource } from '@prisma/client';
import { IsBoolean, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ToBoolean } from '../../../common/decorators/to-boolean.decorator.js';
import { QuotesQueryDto } from './quotes-query.dto.js';
export class AdminQuotesQueryDto extends QuotesQueryDto {
    unlinkedOnly;
    missingTranslation;
    textSource;
    unverifiedOnly;
}
__decorate([
    IsOptional(),
    ToBoolean(),
    IsBoolean(),
    __metadata("design:type", Boolean)
], AdminQuotesQueryDto.prototype, "unlinkedOnly", void 0);
__decorate([
    IsOptional(),
    IsString(),
    MaxLength(10),
    __metadata("design:type", String)
], AdminQuotesQueryDto.prototype, "missingTranslation", void 0);
__decorate([
    IsOptional(),
    IsEnum(TextSource),
    __metadata("design:type", String)
], AdminQuotesQueryDto.prototype, "textSource", void 0);
__decorate([
    IsOptional(),
    ToBoolean(),
    IsBoolean(),
    __metadata("design:type", Boolean)
], AdminQuotesQueryDto.prototype, "unverifiedOnly", void 0);
//# sourceMappingURL=admin-quotes-query.dto.js.map