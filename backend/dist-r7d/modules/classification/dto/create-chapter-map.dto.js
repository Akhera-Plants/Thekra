var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { ChapterMapTarget } from '@prisma/client';
import { IsBoolean, IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
export class CreateChapterMapDto {
    sourceId;
    chapterKey;
    chapterTitleAr;
    targetType;
    sinId;
    goodDeedId;
    imanBranchId;
    reviewed;
}
__decorate([
    IsUUID(),
    __metadata("design:type", String)
], CreateChapterMapDto.prototype, "sourceId", void 0);
__decorate([
    IsString(),
    MaxLength(200),
    __metadata("design:type", String)
], CreateChapterMapDto.prototype, "chapterKey", void 0);
__decorate([
    IsString(),
    MaxLength(500),
    __metadata("design:type", String)
], CreateChapterMapDto.prototype, "chapterTitleAr", void 0);
__decorate([
    IsEnum(ChapterMapTarget),
    __metadata("design:type", String)
], CreateChapterMapDto.prototype, "targetType", void 0);
__decorate([
    IsOptional(),
    IsUUID(),
    __metadata("design:type", String)
], CreateChapterMapDto.prototype, "sinId", void 0);
__decorate([
    IsOptional(),
    IsUUID(),
    __metadata("design:type", String)
], CreateChapterMapDto.prototype, "goodDeedId", void 0);
__decorate([
    IsOptional(),
    IsUUID(),
    __metadata("design:type", String)
], CreateChapterMapDto.prototype, "imanBranchId", void 0);
__decorate([
    IsOptional(),
    IsBoolean(),
    __metadata("design:type", Boolean)
], CreateChapterMapDto.prototype, "reviewed", void 0);
//# sourceMappingURL=create-chapter-map.dto.js.map