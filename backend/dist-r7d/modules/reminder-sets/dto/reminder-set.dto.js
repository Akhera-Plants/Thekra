var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { PartialType } from '@nestjs/mapped-types';
import { ArrayMaxSize, ArrayUnique, IsArray, IsBoolean, IsInt, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, MinLength, } from 'class-validator';
import { REMINDER_SET_MAX_ITEMS } from '../reminder-set-rules.js';
export class CreateReminderSetDto {
    slug;
    titleAr;
    titleEn;
    sortOrder;
    published;
}
__decorate([
    IsString(),
    MinLength(1),
    MaxLength(80),
    Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, { message: 'slug must be kebab-case' }),
    __metadata("design:type", String)
], CreateReminderSetDto.prototype, "slug", void 0);
__decorate([
    IsString(),
    MinLength(1),
    MaxLength(120),
    __metadata("design:type", String)
], CreateReminderSetDto.prototype, "titleAr", void 0);
__decorate([
    IsString(),
    MinLength(1),
    MaxLength(120),
    __metadata("design:type", String)
], CreateReminderSetDto.prototype, "titleEn", void 0);
__decorate([
    IsOptional(),
    IsInt(),
    Min(0),
    Max(1000),
    __metadata("design:type", Number)
], CreateReminderSetDto.prototype, "sortOrder", void 0);
__decorate([
    IsOptional(),
    IsBoolean(),
    __metadata("design:type", Boolean)
], CreateReminderSetDto.prototype, "published", void 0);
export class UpdateReminderSetDto extends PartialType(CreateReminderSetDto) {
}
export class SetReminderSetItemsDto {
    quoteIds;
}
__decorate([
    IsArray(),
    ArrayMaxSize(REMINDER_SET_MAX_ITEMS),
    ArrayUnique(),
    IsUUID('all', { each: true }),
    __metadata("design:type", Array)
], SetReminderSetItemsDto.prototype, "quoteIds", void 0);
//# sourceMappingURL=reminder-set.dto.js.map