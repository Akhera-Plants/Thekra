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
import { IsInt, IsOptional, Matches, Max, Min } from 'class-validator';
import { LocaleQueryDto } from '../../../common/dto/locale-query.dto.js';
export const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
export class OccasionsQueryDto extends LocaleQueryDto {
    from;
    to;
    hijriOffset;
}
__decorate([
    IsOptional(),
    Matches(DATE_PATTERN, { message: 'from must be YYYY-MM-DD' }),
    __metadata("design:type", String)
], OccasionsQueryDto.prototype, "from", void 0);
__decorate([
    IsOptional(),
    Matches(DATE_PATTERN, { message: 'to must be YYYY-MM-DD' }),
    __metadata("design:type", String)
], OccasionsQueryDto.prototype, "to", void 0);
__decorate([
    IsOptional(),
    Type(() => Number),
    IsInt(),
    Min(-2),
    Max(2),
    __metadata("design:type", Number)
], OccasionsQueryDto.prototype, "hijriOffset", void 0);
//# sourceMappingURL=occasions-query.dto.js.map