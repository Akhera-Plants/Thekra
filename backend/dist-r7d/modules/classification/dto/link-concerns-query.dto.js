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
import { IsEnum, IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { LinkConcern } from '@prisma/client';
export const LINK_KINDS = ['sin', 'good-deed', 'branch'];
export class LinkConcernsQueryDto {
    kind;
    concern;
    limit;
}
__decorate([
    IsOptional(),
    IsIn(LINK_KINDS),
    __metadata("design:type", String)
], LinkConcernsQueryDto.prototype, "kind", void 0);
__decorate([
    IsOptional(),
    IsEnum(LinkConcern),
    __metadata("design:type", String)
], LinkConcernsQueryDto.prototype, "concern", void 0);
__decorate([
    IsOptional(),
    Type(() => Number),
    IsInt(),
    Min(1),
    Max(200),
    __metadata("design:type", Number)
], LinkConcernsQueryDto.prototype, "limit", void 0);
//# sourceMappingURL=link-concerns-query.dto.js.map