var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { IsOptional, IsString, IsUUID, Matches, MaxLength, MinLength } from 'class-validator';
import { IsOptionalNotNull } from '../../../common/decorators/is-optional-not-null.decorator.js';
export class UpdateGoodDeedDto {
    name;
    nameAr;
    slug;
    category;
    description;
    descriptionAr;
    reward;
    rewardAr;
    oppositeSinId;
}
__decorate([
    IsOptionalNotNull(),
    IsString(),
    MinLength(1),
    MaxLength(300),
    __metadata("design:type", String)
], UpdateGoodDeedDto.prototype, "name", void 0);
__decorate([
    IsOptionalNotNull(),
    IsString(),
    MinLength(1),
    MaxLength(300),
    Matches(/[\u0600-\u06FF]/, { message: 'nameAr must contain Arabic script' }),
    __metadata("design:type", String)
], UpdateGoodDeedDto.prototype, "nameAr", void 0);
__decorate([
    IsOptionalNotNull(),
    IsString(),
    MinLength(1),
    MaxLength(200),
    Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, { message: 'slug must be kebab-case' }),
    __metadata("design:type", String)
], UpdateGoodDeedDto.prototype, "slug", void 0);
__decorate([
    IsOptional(),
    IsString(),
    MaxLength(100),
    __metadata("design:type", Object)
], UpdateGoodDeedDto.prototype, "category", void 0);
__decorate([
    IsOptional(),
    IsString(),
    MaxLength(5000),
    __metadata("design:type", Object)
], UpdateGoodDeedDto.prototype, "description", void 0);
__decorate([
    IsOptional(),
    IsString(),
    MaxLength(5000),
    __metadata("design:type", Object)
], UpdateGoodDeedDto.prototype, "descriptionAr", void 0);
__decorate([
    IsOptional(),
    IsString(),
    MaxLength(2000),
    __metadata("design:type", Object)
], UpdateGoodDeedDto.prototype, "reward", void 0);
__decorate([
    IsOptional(),
    IsString(),
    MaxLength(2000),
    __metadata("design:type", Object)
], UpdateGoodDeedDto.prototype, "rewardAr", void 0);
__decorate([
    IsOptional(),
    IsUUID(),
    __metadata("design:type", Object)
], UpdateGoodDeedDto.prototype, "oppositeSinId", void 0);
//# sourceMappingURL=update-good-deed.dto.js.map