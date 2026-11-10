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
import { ArrayMaxSize, ArrayMinSize, IsArray, IsUUID, ValidateNested, } from 'class-validator';
import { BulkLinkItemDto } from './bulk-link-item.dto.js';
export class BulkLinkGoodDeedQuotesDto {
    goodDeedId;
    links;
}
__decorate([
    IsUUID(),
    __metadata("design:type", String)
], BulkLinkGoodDeedQuotesDto.prototype, "goodDeedId", void 0);
__decorate([
    IsArray(),
    ArrayMinSize(1),
    ArrayMaxSize(100),
    ValidateNested({ each: true }),
    Type(() => BulkLinkItemDto),
    __metadata("design:type", Array)
], BulkLinkGoodDeedQuotesDto.prototype, "links", void 0);
//# sourceMappingURL=bulk-link-good-deed-quotes.dto.js.map