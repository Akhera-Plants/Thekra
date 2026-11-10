var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { IsBoolean, IsEnum, IsOptional, IsString, IsUrl, MaxLength, MinLength, } from 'class-validator';
import { SourceType } from '@prisma/client';
export class CreateSourceDto {
    name;
    nameAr;
    type;
    author;
    authorAr;
    language;
    isExternalApi;
    apiProvider;
    apiBaseUrl;
}
__decorate([
    IsString(),
    MinLength(1),
    MaxLength(300),
    __metadata("design:type", String)
], CreateSourceDto.prototype, "name", void 0);
__decorate([
    IsOptional(),
    IsString(),
    MaxLength(300),
    __metadata("design:type", String)
], CreateSourceDto.prototype, "nameAr", void 0);
__decorate([
    IsEnum(SourceType),
    __metadata("design:type", String)
], CreateSourceDto.prototype, "type", void 0);
__decorate([
    IsOptional(),
    IsString(),
    MaxLength(300),
    __metadata("design:type", String)
], CreateSourceDto.prototype, "author", void 0);
__decorate([
    IsOptional(),
    IsString(),
    MaxLength(300),
    __metadata("design:type", String)
], CreateSourceDto.prototype, "authorAr", void 0);
__decorate([
    IsOptional(),
    IsString(),
    MaxLength(10),
    __metadata("design:type", String)
], CreateSourceDto.prototype, "language", void 0);
__decorate([
    IsOptional(),
    IsBoolean(),
    __metadata("design:type", Boolean)
], CreateSourceDto.prototype, "isExternalApi", void 0);
__decorate([
    IsOptional(),
    IsString(),
    MaxLength(100),
    __metadata("design:type", String)
], CreateSourceDto.prototype, "apiProvider", void 0);
__decorate([
    IsOptional(),
    IsUrl({}, { message: 'apiBaseUrl must be a valid URL' }),
    MaxLength(500),
    __metadata("design:type", String)
], CreateSourceDto.prototype, "apiBaseUrl", void 0);
//# sourceMappingURL=create-source.dto.js.map