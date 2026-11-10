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
import { IsInt, IsOptional, IsString, IsUUID, MaxLength, Min, } from 'class-validator';
export class CreateImanBranchDto {
    number;
    titleAr;
    title;
    summaryAr;
    summary;
    sourceId;
    sourceReference;
}
__decorate([
    Type(() => Number),
    IsInt(),
    Min(1),
    __metadata("design:type", Number)
], CreateImanBranchDto.prototype, "number", void 0);
__decorate([
    IsString(),
    MaxLength(300),
    __metadata("design:type", String)
], CreateImanBranchDto.prototype, "titleAr", void 0);
__decorate([
    IsOptional(),
    IsString(),
    MaxLength(300),
    __metadata("design:type", String)
], CreateImanBranchDto.prototype, "title", void 0);
__decorate([
    IsOptional(),
    IsString(),
    MaxLength(8000),
    __metadata("design:type", String)
], CreateImanBranchDto.prototype, "summaryAr", void 0);
__decorate([
    IsOptional(),
    IsString(),
    MaxLength(8000),
    __metadata("design:type", String)
], CreateImanBranchDto.prototype, "summary", void 0);
__decorate([
    IsOptional(),
    IsUUID(),
    __metadata("design:type", String)
], CreateImanBranchDto.prototype, "sourceId", void 0);
__decorate([
    IsOptional(),
    IsString(),
    MaxLength(200),
    __metadata("design:type", String)
], CreateImanBranchDto.prototype, "sourceReference", void 0);
//# sourceMappingURL=create-iman-branch.dto.js.map