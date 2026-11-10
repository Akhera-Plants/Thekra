var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { IsBoolean, IsIn, IsOptional } from 'class-validator';
import { ToBoolean } from '../../../common/decorators/to-boolean.decorator.js';
export class QuoteDetailQueryDto {
    lang = 'ar';
    includeAllTranslations = false;
    includeLinks = true;
}
__decorate([
    IsOptional(),
    IsIn(['ar', 'en']),
    __metadata("design:type", String)
], QuoteDetailQueryDto.prototype, "lang", void 0);
__decorate([
    IsOptional(),
    ToBoolean(),
    IsBoolean(),
    __metadata("design:type", Boolean)
], QuoteDetailQueryDto.prototype, "includeAllTranslations", void 0);
__decorate([
    IsOptional(),
    ToBoolean(),
    IsBoolean(),
    __metadata("design:type", Boolean)
], QuoteDetailQueryDto.prototype, "includeLinks", void 0);
//# sourceMappingURL=quote-detail-query.dto.js.map