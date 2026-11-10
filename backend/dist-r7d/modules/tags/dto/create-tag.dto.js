var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { IsEnum, IsOptional, IsString, Matches, MaxLength, MinLength, } from 'class-validator';
import { TagCategory } from '@prisma/client';
export class CreateTagDto {
    name;
    nameAr;
    slug;
    category;
}
__decorate([
    IsString(),
    MinLength(1),
    MaxLength(200),
    __metadata("design:type", String)
], CreateTagDto.prototype, "name", void 0);
__decorate([
    IsOptional(),
    IsString(),
    MaxLength(200),
    __metadata("design:type", String)
], CreateTagDto.prototype, "nameAr", void 0);
__decorate([
    IsString(),
    MinLength(1),
    MaxLength(200),
    Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, { message: 'slug must be kebab-case' }),
    __metadata("design:type", String)
], CreateTagDto.prototype, "slug", void 0);
__decorate([
    IsEnum(TagCategory),
    __metadata("design:type", String)
], CreateTagDto.prototype, "category", void 0);
//# sourceMappingURL=create-tag.dto.js.map