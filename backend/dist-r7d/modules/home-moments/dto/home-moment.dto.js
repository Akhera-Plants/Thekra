var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { OmitType, PartialType } from '@nestjs/mapped-types';
import { HomeMomentTopic } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength, ValidateIf } from 'class-validator';
import { MOMENT_ICON, MOMENT_KEY, MOMENT_LABEL_MAX, MOMENT_SITUATION_MAX } from '../home-moments-yaml.js';
const trim = ({ value }) => (typeof value === 'string' ? value.trim() : value);
const SAFE_TEXT = /^[^\p{Cc}‪-‮⁦-⁩]+$/u;
export class CreateHomeMomentDto {
    key;
    topicType;
    topicSlug;
    labelAr;
    labelEn;
    situationAr;
    situationEn;
    icon;
    sortOrder;
    published;
}
__decorate([
    IsString(),
    MaxLength(40),
    Matches(MOMENT_KEY, { message: 'key must be kebab-case' }),
    __metadata("design:type", String)
], CreateHomeMomentDto.prototype, "key", void 0);
__decorate([
    IsEnum(HomeMomentTopic),
    __metadata("design:type", String)
], CreateHomeMomentDto.prototype, "topicType", void 0);
__decorate([
    IsString(),
    MaxLength(80),
    Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, { message: 'topicSlug must be a slug or a branch number' }),
    __metadata("design:type", String)
], CreateHomeMomentDto.prototype, "topicSlug", void 0);
__decorate([
    Transform(trim),
    IsString(),
    MinLength(1),
    MaxLength(MOMENT_LABEL_MAX),
    Matches(SAFE_TEXT),
    __metadata("design:type", String)
], CreateHomeMomentDto.prototype, "labelAr", void 0);
__decorate([
    Transform(trim),
    IsString(),
    MinLength(1),
    MaxLength(MOMENT_LABEL_MAX),
    Matches(SAFE_TEXT),
    __metadata("design:type", String)
], CreateHomeMomentDto.prototype, "labelEn", void 0);
__decorate([
    IsOptional(),
    Transform(trim),
    ValidateIf((_o, value) => value !== null),
    IsString(),
    MinLength(1),
    MaxLength(MOMENT_SITUATION_MAX),
    Matches(SAFE_TEXT),
    __metadata("design:type", Object)
], CreateHomeMomentDto.prototype, "situationAr", void 0);
__decorate([
    IsOptional(),
    Transform(trim),
    ValidateIf((_o, value) => value !== null),
    IsString(),
    MinLength(1),
    MaxLength(MOMENT_SITUATION_MAX),
    Matches(SAFE_TEXT),
    __metadata("design:type", Object)
], CreateHomeMomentDto.prototype, "situationEn", void 0);
__decorate([
    IsString(),
    MaxLength(32),
    Matches(MOMENT_ICON, { message: 'icon must be a kebab-case key' }),
    __metadata("design:type", String)
], CreateHomeMomentDto.prototype, "icon", void 0);
__decorate([
    IsOptional(),
    IsInt(),
    Min(0),
    Max(1000),
    __metadata("design:type", Number)
], CreateHomeMomentDto.prototype, "sortOrder", void 0);
__decorate([
    IsOptional(),
    IsBoolean(),
    __metadata("design:type", Boolean)
], CreateHomeMomentDto.prototype, "published", void 0);
export class UpdateHomeMomentDto extends PartialType(OmitType(CreateHomeMomentDto, ['key'])) {
}
//# sourceMappingURL=home-moment.dto.js.map