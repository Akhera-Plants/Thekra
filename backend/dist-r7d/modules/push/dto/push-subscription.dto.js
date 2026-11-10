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
import { MAX_MUTED, parseResolvedAnchorTimes, PRAYER_CACHE_DAYS, STRATEGY_KEYS } from '@thekra/practice-core';
import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, IsUrl, Matches, Max, MaxLength, Min, ValidateBy, ValidateNested, } from 'class-validator';
const BASE64URL = /^[A-Za-z0-9_-]+={0,2}$/;
const HH_MM = /^([01]\d|2[0-3]):[0-5]\d$/;
function IsAnchorTimes(options) {
    return ValidateBy({
        name: 'isAnchorTimes',
        validator: {
            validate: (value) => {
                if (typeof value !== 'object' || value === null || Array.isArray(value))
                    return false;
                const keys = Object.keys(value);
                return keys.length <= PRAYER_CACHE_DAYS && Object.keys(parseResolvedAnchorTimes(value)).length === keys.length;
            },
            defaultMessage: () => `anchorTimes must map at most ${PRAYER_CACHE_DAYS} dates to every prayer anchor's HH:MM`,
        },
    }, options);
}
export class PushPrefsDto {
    habits;
    periodic;
    periodicTime;
    eveningNudge;
    eveningTime;
    fridayReview;
    fridayTime;
    reviewDay;
    occasions;
    occasionTime;
    strategies;
    strategyTime;
    strategyDay;
    intentionReminder;
    intentionTime;
    mutedPlans;
    mutedActs;
    anchorTimes;
}
__decorate([
    IsOptional(),
    IsBoolean(),
    __metadata("design:type", Boolean)
], PushPrefsDto.prototype, "habits", void 0);
__decorate([
    IsOptional(),
    IsBoolean(),
    __metadata("design:type", Boolean)
], PushPrefsDto.prototype, "periodic", void 0);
__decorate([
    IsOptional(),
    IsString(),
    Matches(HH_MM),
    __metadata("design:type", String)
], PushPrefsDto.prototype, "periodicTime", void 0);
__decorate([
    IsOptional(),
    IsBoolean(),
    __metadata("design:type", Boolean)
], PushPrefsDto.prototype, "eveningNudge", void 0);
__decorate([
    IsOptional(),
    IsString(),
    Matches(HH_MM),
    __metadata("design:type", String)
], PushPrefsDto.prototype, "eveningTime", void 0);
__decorate([
    IsOptional(),
    IsBoolean(),
    __metadata("design:type", Boolean)
], PushPrefsDto.prototype, "fridayReview", void 0);
__decorate([
    IsOptional(),
    IsString(),
    Matches(HH_MM),
    __metadata("design:type", String)
], PushPrefsDto.prototype, "fridayTime", void 0);
__decorate([
    IsOptional(),
    IsInt(),
    Min(0),
    Max(6),
    __metadata("design:type", Number)
], PushPrefsDto.prototype, "reviewDay", void 0);
__decorate([
    IsOptional(),
    IsBoolean(),
    __metadata("design:type", Boolean)
], PushPrefsDto.prototype, "occasions", void 0);
__decorate([
    IsOptional(),
    IsString(),
    Matches(HH_MM),
    __metadata("design:type", String)
], PushPrefsDto.prototype, "occasionTime", void 0);
__decorate([
    IsOptional(),
    IsArray(),
    ArrayMaxSize(STRATEGY_KEYS.length),
    IsIn(STRATEGY_KEYS, { each: true }),
    __metadata("design:type", Array)
], PushPrefsDto.prototype, "strategies", void 0);
__decorate([
    IsOptional(),
    IsString(),
    Matches(HH_MM),
    __metadata("design:type", String)
], PushPrefsDto.prototype, "strategyTime", void 0);
__decorate([
    IsOptional(),
    IsInt(),
    Min(0),
    Max(6),
    __metadata("design:type", Number)
], PushPrefsDto.prototype, "strategyDay", void 0);
__decorate([
    IsOptional(),
    IsBoolean(),
    __metadata("design:type", Boolean)
], PushPrefsDto.prototype, "intentionReminder", void 0);
__decorate([
    IsOptional(),
    IsString(),
    Matches(HH_MM),
    __metadata("design:type", String)
], PushPrefsDto.prototype, "intentionTime", void 0);
__decorate([
    IsOptional(),
    IsArray(),
    ArrayMaxSize(MAX_MUTED),
    IsString({ each: true }),
    MaxLength(80, { each: true }),
    __metadata("design:type", Array)
], PushPrefsDto.prototype, "mutedPlans", void 0);
__decorate([
    IsOptional(),
    IsArray(),
    ArrayMaxSize(MAX_MUTED),
    IsString({ each: true }),
    MaxLength(80, { each: true }),
    __metadata("design:type", Array)
], PushPrefsDto.prototype, "mutedActs", void 0);
__decorate([
    IsOptional(),
    IsAnchorTimes(),
    __metadata("design:type", Object)
], PushPrefsDto.prototype, "anchorTimes", void 0);
export class PushKeysDto {
    p256dh;
    auth;
}
__decorate([
    IsString(),
    MaxLength(200),
    Matches(BASE64URL),
    __metadata("design:type", String)
], PushKeysDto.prototype, "p256dh", void 0);
__decorate([
    IsString(),
    MaxLength(100),
    Matches(BASE64URL),
    __metadata("design:type", String)
], PushKeysDto.prototype, "auth", void 0);
export class PushSubscriptionDto {
    endpoint;
    keys;
    timeZone;
    locale;
    prefs;
}
__decorate([
    IsUrl({ protocols: ['https'], require_protocol: true, require_tld: true }),
    MaxLength(1000),
    __metadata("design:type", String)
], PushSubscriptionDto.prototype, "endpoint", void 0);
__decorate([
    ValidateNested(),
    Type(() => PushKeysDto),
    __metadata("design:type", PushKeysDto)
], PushSubscriptionDto.prototype, "keys", void 0);
__decorate([
    IsString(),
    MaxLength(64),
    __metadata("design:type", String)
], PushSubscriptionDto.prototype, "timeZone", void 0);
__decorate([
    IsIn(['ar', 'en']),
    __metadata("design:type", String)
], PushSubscriptionDto.prototype, "locale", void 0);
__decorate([
    IsOptional(),
    ValidateNested(),
    Type(() => PushPrefsDto),
    __metadata("design:type", PushPrefsDto)
], PushSubscriptionDto.prototype, "prefs", void 0);
export class PushEndpointDto {
    endpoint;
}
__decorate([
    IsUrl({ protocols: ['https'], require_protocol: true, require_tld: true }),
    MaxLength(1000),
    __metadata("design:type", String)
], PushEndpointDto.prototype, "endpoint", void 0);
export class PushTestDto extends PushEndpointDto {
    locale;
}
__decorate([
    IsIn(['ar', 'en']),
    __metadata("design:type", String)
], PushTestDto.prototype, "locale", void 0);
//# sourceMappingURL=push-subscription.dto.js.map