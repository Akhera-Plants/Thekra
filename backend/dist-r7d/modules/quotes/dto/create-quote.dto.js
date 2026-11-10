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
import { ArrayMaxSize, IsArray, IsEnum, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, MinLength, ValidateNested, } from 'class-validator';
import { HadithGrade, QuoteOrigin, QuoteType } from '@prisma/client';
import { IsStrictInt } from '../../../common/decorators/is-strict-int.decorator.js';
import { ValidQuoteShape } from './valid-quote-shape.decorator.js';
export class TranslationInputDto {
    languageCode;
    text;
}
__decorate([
    Matches(/^[a-z]{2}(-[A-Z]{2})?$/, {
        message: 'languageCode must be in the format "en" or "en-US"',
    }),
    __metadata("design:type", String)
], TranslationInputDto.prototype, "languageCode", void 0);
__decorate([
    IsString(),
    MaxLength(10000),
    __metadata("design:type", String)
], TranslationInputDto.prototype, "text", void 0);
let CreateQuoteDto = class CreateQuoteDto {
    type;
    origin;
    textAr;
    sourceId;
    surahNumber;
    surahName;
    surahNameAr;
    ayahNumber;
    narrator;
    narratorAr;
    grade;
    hadithReference;
    referenceNumber;
    referenceLabel;
    bookTitle;
    author;
    pageOrChapter;
    volume;
    page;
    gradeAuthority;
    gradeReference;
    translations;
    tagIds;
};
__decorate([
    IsEnum(QuoteType),
    __metadata("design:type", String)
], CreateQuoteDto.prototype, "type", void 0);
__decorate([
    IsOptional(),
    IsEnum(QuoteOrigin),
    __metadata("design:type", String)
], CreateQuoteDto.prototype, "origin", void 0);
__decorate([
    IsString(),
    MinLength(3),
    MaxLength(10000),
    Matches(/[\u0600-\u06FF]/, {
        message: 'textAr must contain Arabic script',
    }),
    __metadata("design:type", String)
], CreateQuoteDto.prototype, "textAr", void 0);
__decorate([
    IsUUID(),
    __metadata("design:type", String)
], CreateQuoteDto.prototype, "sourceId", void 0);
__decorate([
    IsOptional(),
    IsStrictInt(),
    Min(1),
    Max(114),
    __metadata("design:type", Number)
], CreateQuoteDto.prototype, "surahNumber", void 0);
__decorate([
    IsOptional(),
    IsString(),
    MaxLength(100),
    __metadata("design:type", String)
], CreateQuoteDto.prototype, "surahName", void 0);
__decorate([
    IsOptional(),
    IsString(),
    MaxLength(100),
    __metadata("design:type", String)
], CreateQuoteDto.prototype, "surahNameAr", void 0);
__decorate([
    IsOptional(),
    IsStrictInt(),
    Min(1),
    Max(286),
    __metadata("design:type", Number)
], CreateQuoteDto.prototype, "ayahNumber", void 0);
__decorate([
    IsOptional(),
    IsString(),
    MaxLength(200),
    __metadata("design:type", String)
], CreateQuoteDto.prototype, "narrator", void 0);
__decorate([
    IsOptional(),
    IsString(),
    MaxLength(200),
    __metadata("design:type", String)
], CreateQuoteDto.prototype, "narratorAr", void 0);
__decorate([
    IsOptional(),
    IsEnum(HadithGrade),
    __metadata("design:type", String)
], CreateQuoteDto.prototype, "grade", void 0);
__decorate([
    IsOptional(),
    IsString(),
    MaxLength(200),
    __metadata("design:type", String)
], CreateQuoteDto.prototype, "hadithReference", void 0);
__decorate([
    IsOptional(),
    IsStrictInt(),
    Min(1),
    __metadata("design:type", Number)
], CreateQuoteDto.prototype, "referenceNumber", void 0);
__decorate([
    IsOptional(),
    IsString(),
    MaxLength(40),
    __metadata("design:type", String)
], CreateQuoteDto.prototype, "referenceLabel", void 0);
__decorate([
    IsOptional(),
    IsString(),
    MaxLength(300),
    __metadata("design:type", String)
], CreateQuoteDto.prototype, "bookTitle", void 0);
__decorate([
    IsOptional(),
    IsString(),
    MaxLength(300),
    __metadata("design:type", String)
], CreateQuoteDto.prototype, "author", void 0);
__decorate([
    IsOptional(),
    IsString(),
    MaxLength(100),
    __metadata("design:type", String)
], CreateQuoteDto.prototype, "pageOrChapter", void 0);
__decorate([
    IsOptional(),
    IsString(),
    MaxLength(40),
    __metadata("design:type", String)
], CreateQuoteDto.prototype, "volume", void 0);
__decorate([
    IsOptional(),
    IsString(),
    MaxLength(40),
    __metadata("design:type", String)
], CreateQuoteDto.prototype, "page", void 0);
__decorate([
    IsOptional(),
    IsString(),
    MaxLength(200),
    __metadata("design:type", String)
], CreateQuoteDto.prototype, "gradeAuthority", void 0);
__decorate([
    IsOptional(),
    IsString(),
    MaxLength(300),
    __metadata("design:type", String)
], CreateQuoteDto.prototype, "gradeReference", void 0);
__decorate([
    IsOptional(),
    IsArray(),
    ValidateNested({ each: true }),
    Type(() => TranslationInputDto),
    __metadata("design:type", Array)
], CreateQuoteDto.prototype, "translations", void 0);
__decorate([
    IsOptional(),
    IsArray(),
    IsUUID('4', { each: true }),
    ArrayMaxSize(20),
    __metadata("design:type", Array)
], CreateQuoteDto.prototype, "tagIds", void 0);
CreateQuoteDto = __decorate([
    ValidQuoteShape()
], CreateQuoteDto);
export { CreateQuoteDto };
//# sourceMappingURL=create-quote.dto.js.map