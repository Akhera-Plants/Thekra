var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { IsEnum, IsOptional, IsString, IsUUID, Max, MaxLength, Min, } from 'class-validator';
import { LinkReviewStatus } from '@prisma/client';
import { IsStrictInt } from '../../../common/decorators/is-strict-int.decorator.js';
export class LinkGoodDeedQuoteDto {
    goodDeedId;
    quoteId;
    relevanceScore;
    note;
    reviewStatus;
}
__decorate([
    IsUUID(),
    __metadata("design:type", String)
], LinkGoodDeedQuoteDto.prototype, "goodDeedId", void 0);
__decorate([
    IsUUID(),
    __metadata("design:type", String)
], LinkGoodDeedQuoteDto.prototype, "quoteId", void 0);
__decorate([
    IsOptional(),
    IsStrictInt(),
    Min(0),
    Max(100),
    __metadata("design:type", Number)
], LinkGoodDeedQuoteDto.prototype, "relevanceScore", void 0);
__decorate([
    IsOptional(),
    IsString(),
    MaxLength(1000),
    __metadata("design:type", String)
], LinkGoodDeedQuoteDto.prototype, "note", void 0);
__decorate([
    IsOptional(),
    IsEnum(LinkReviewStatus),
    __metadata("design:type", String)
], LinkGoodDeedQuoteDto.prototype, "reviewStatus", void 0);
//# sourceMappingURL=link-good-deed-quote.dto.js.map