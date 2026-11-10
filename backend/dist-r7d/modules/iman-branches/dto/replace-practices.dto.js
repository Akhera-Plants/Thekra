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
import { IsArray, IsInt, IsOptional, IsString, IsUUID, MaxLength, Min, ValidateNested, } from 'class-validator';
class BranchGoodDeedItemDto {
    goodDeedId;
    sortOrder;
    note;
}
__decorate([
    IsUUID(),
    __metadata("design:type", String)
], BranchGoodDeedItemDto.prototype, "goodDeedId", void 0);
__decorate([
    IsOptional(),
    Type(() => Number),
    IsInt(),
    Min(0),
    __metadata("design:type", Number)
], BranchGoodDeedItemDto.prototype, "sortOrder", void 0);
__decorate([
    IsOptional(),
    IsString(),
    MaxLength(1000),
    __metadata("design:type", String)
], BranchGoodDeedItemDto.prototype, "note", void 0);
class BranchSinItemDto {
    sinId;
    sortOrder;
    note;
}
__decorate([
    IsUUID(),
    __metadata("design:type", String)
], BranchSinItemDto.prototype, "sinId", void 0);
__decorate([
    IsOptional(),
    Type(() => Number),
    IsInt(),
    Min(0),
    __metadata("design:type", Number)
], BranchSinItemDto.prototype, "sortOrder", void 0);
__decorate([
    IsOptional(),
    IsString(),
    MaxLength(1000),
    __metadata("design:type", String)
], BranchSinItemDto.prototype, "note", void 0);
export class ReplaceBranchPracticesDto {
    goodDeeds;
    sins;
}
__decorate([
    IsArray(),
    ValidateNested({ each: true }),
    Type(() => BranchGoodDeedItemDto),
    __metadata("design:type", Array)
], ReplaceBranchPracticesDto.prototype, "goodDeeds", void 0);
__decorate([
    IsArray(),
    ValidateNested({ each: true }),
    Type(() => BranchSinItemDto),
    __metadata("design:type", Array)
], ReplaceBranchPracticesDto.prototype, "sins", void 0);
//# sourceMappingURL=replace-practices.dto.js.map