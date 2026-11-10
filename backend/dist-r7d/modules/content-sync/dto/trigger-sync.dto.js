var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { IsBoolean, IsInt, IsOptional, IsString, IsUUID, Max, Min, ValidateNested, } from 'class-validator';
import { Type } from 'class-transformer';
export class SyncScopeDto {
    surahFrom;
    surahTo;
    collection;
    bookFrom;
    bookTo;
}
__decorate([
    IsOptional(),
    IsInt(),
    Min(1),
    Max(114),
    __metadata("design:type", Number)
], SyncScopeDto.prototype, "surahFrom", void 0);
__decorate([
    IsOptional(),
    IsInt(),
    Min(1),
    Max(114),
    __metadata("design:type", Number)
], SyncScopeDto.prototype, "surahTo", void 0);
__decorate([
    IsOptional(),
    IsString(),
    __metadata("design:type", String)
], SyncScopeDto.prototype, "collection", void 0);
__decorate([
    IsOptional(),
    IsInt(),
    Min(1),
    __metadata("design:type", Number)
], SyncScopeDto.prototype, "bookFrom", void 0);
__decorate([
    IsOptional(),
    IsInt(),
    Min(1),
    __metadata("design:type", Number)
], SyncScopeDto.prototype, "bookTo", void 0);
export class TriggerSyncDto {
    sourceId;
    scope;
    dryRun = false;
    force = false;
}
__decorate([
    IsUUID(),
    __metadata("design:type", String)
], TriggerSyncDto.prototype, "sourceId", void 0);
__decorate([
    IsOptional(),
    ValidateNested(),
    Type(() => SyncScopeDto),
    __metadata("design:type", SyncScopeDto)
], TriggerSyncDto.prototype, "scope", void 0);
__decorate([
    IsOptional(),
    IsBoolean(),
    __metadata("design:type", Boolean)
], TriggerSyncDto.prototype, "dryRun", void 0);
__decorate([
    IsOptional(),
    IsBoolean(),
    __metadata("design:type", Boolean)
], TriggerSyncDto.prototype, "force", void 0);
//# sourceMappingURL=trigger-sync.dto.js.map