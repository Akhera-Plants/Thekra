var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { IntersectionType, OmitType, PartialType } from '@nestjs/mapped-types';
import { IsString, IsUUID, Matches, MaxLength, MinLength } from 'class-validator';
import { IsOptionalNotNull } from '../../../common/decorators/is-optional-not-null.decorator.js';
import { CreateQuoteDto } from './create-quote.dto.js';
class NonNullableQuoteFields {
    textAr;
    sourceId;
}
__decorate([
    IsOptionalNotNull(),
    IsString(),
    MinLength(3),
    MaxLength(10000),
    Matches(/[\u0600-\u06FF]/, { message: 'textAr must contain Arabic script' }),
    __metadata("design:type", String)
], NonNullableQuoteFields.prototype, "textAr", void 0);
__decorate([
    IsOptionalNotNull(),
    IsUUID(),
    __metadata("design:type", String)
], NonNullableQuoteFields.prototype, "sourceId", void 0);
export class UpdateQuoteDto extends IntersectionType(PartialType(OmitType(CreateQuoteDto, ['type', 'origin', 'textAr', 'sourceId'])), NonNullableQuoteFields) {
}
//# sourceMappingURL=update-quote.dto.js.map