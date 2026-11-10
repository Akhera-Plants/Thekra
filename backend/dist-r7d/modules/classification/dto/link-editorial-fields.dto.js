var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { LinkConcern } from '@prisma/client';
const trimOrNull = ({ value }) => (typeof value === 'string' ? value.trim() || null : value);
export class LinkEditorialFieldsDto {
    reminderAngle;
    reminderAngleEn;
    concern;
    concernNote;
}
__decorate([
    IsOptional(),
    Transform(trimOrNull),
    IsString(),
    MaxLength(2000),
    __metadata("design:type", Object)
], LinkEditorialFieldsDto.prototype, "reminderAngle", void 0);
__decorate([
    IsOptional(),
    Transform(trimOrNull),
    IsString(),
    MaxLength(2000),
    __metadata("design:type", Object)
], LinkEditorialFieldsDto.prototype, "reminderAngleEn", void 0);
__decorate([
    IsOptional(),
    IsEnum(LinkConcern),
    __metadata("design:type", Object)
], LinkEditorialFieldsDto.prototype, "concern", void 0);
__decorate([
    IsOptional(),
    Transform(trimOrNull),
    IsString(),
    MaxLength(1000),
    __metadata("design:type", Object)
], LinkEditorialFieldsDto.prototype, "concernNote", void 0);
//# sourceMappingURL=link-editorial-fields.dto.js.map