import { Type } from 'class-transformer';
import { MAX_MUTED, parseResolvedAnchorTimes, PRAYER_CACHE_DAYS, STRATEGY_KEYS } from '@thekra/practice-core';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateBy,
  ValidateNested,
  type ValidationOptions,
} from 'class-validator';

const BASE64URL = /^[A-Za-z0-9_-]+={0,2}$/;
const HH_MM = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Prayer-time anchors resolved by the browser (practice-core `resolvedAnchorTimes`): `{ 'YYYY-MM-DD': { 'after-fajr':
 * 'HH:MM', … } }`, at most {@link PRAYER_CACHE_DAYS} days, every anchor of a day present. The server never calls AlAdhan.
 */
function IsAnchorTimes(options?: ValidationOptions): PropertyDecorator {
  return ValidateBy(
    {
      name: 'isAnchorTimes',
      validator: {
        validate: (value: unknown) => {
          if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
          const keys = Object.keys(value);
          return keys.length <= PRAYER_CACHE_DAYS && Object.keys(parseResolvedAnchorTimes(value)).length === keys.length;
        },
        defaultMessage: () => `anchorTimes must map at most ${PRAYER_CACHE_DAYS} dates to every prayer anchor's HH:MM`,
      },
    },
    options,
  );
}

/**
 * This browser's switches of «التنبيهات» (practice-core `NotificationPrefs` without the private moment, which never
 * reaches the server). Every field is optional; a missing one keeps the practice-core default.
 */
export class PushPrefsDto {
  @IsOptional() @IsBoolean() habits?: boolean;
  @IsOptional() @IsBoolean() periodic?: boolean;
  @IsOptional() @IsString() @Matches(HH_MM) periodicTime?: string;
  @IsOptional() @IsBoolean() eveningNudge?: boolean;
  @IsOptional() @IsString() @Matches(HH_MM) eveningTime?: string;
  @IsOptional() @IsBoolean() fridayReview?: boolean;
  @IsOptional() @IsString() @Matches(HH_MM) fridayTime?: string;
  /** The weekly review's day, 0 = Sunday … 6 = Saturday (Friday by default). */
  @IsOptional() @IsInt() @Min(0) @Max(6) reviewDay?: number;
  /** «مناسبة قريبة» (round 5): the day before a non-weekly occasion, at `occasionTime`. Off by default. */
  @IsOptional() @IsBoolean() occasions?: boolean;
  @IsOptional() @IsString() @Matches(HH_MM) occasionTime?: string;
  /** Round 6 (C-19): the weekly strategy reminder is back: the chosen strategies, one a week, on `strategyDay` at `strategyTime`. */
  @IsOptional() @IsArray() @ArrayMaxSize(STRATEGY_KEYS.length) @IsIn(STRATEGY_KEYS, { each: true }) strategies?: string[];
  @IsOptional() @IsString() @Matches(HH_MM) strategyTime?: string;
  @IsOptional() @IsInt() @Min(0) @Max(6) strategyDay?: number;
  /** Round 6: «نية اليوم» reminder (opt-in). */
  @IsOptional() @IsBoolean() intentionReminder?: boolean;
  @IsOptional() @IsString() @Matches(HH_MM) intentionTime?: string;
  /** Round 6: plans (by id) and periodic acts (by practice-core key, e.g. `silat`) whose reminders are off. */
  @IsOptional() @IsArray() @ArrayMaxSize(MAX_MUTED) @IsString({ each: true }) @MaxLength(80, { each: true }) mutedPlans?: string[];
  @IsOptional() @IsArray() @ArrayMaxSize(MAX_MUTED) @IsString({ each: true }) @MaxLength(80, { each: true }) mutedActs?: string[];
  /** Phase 6: anchored habit slots («بعد الفجر»…) resolve from these per day; days without an entry use the defaults. */
  @IsOptional() @IsAnchorTimes() anchorTimes?: Record<string, Record<string, string>>;
}

export class PushKeysDto {
  @IsString()
  @MaxLength(200)
  @Matches(BASE64URL)
  p256dh!: string;

  @IsString()
  @MaxLength(100)
  @Matches(BASE64URL)
  auth!: string;
}

/** The browser's PushSubscription (`subscription.toJSON()`), plus where and in which language it is used. */
export class PushSubscriptionDto {
  @IsUrl({ protocols: ['https'], require_protocol: true, require_tld: true })
  @MaxLength(1000)
  endpoint!: string;

  @ValidateNested()
  @Type(() => PushKeysDto)
  keys!: PushKeysDto;

  /** IANA zone of the browser (`Intl.DateTimeFormat().resolvedOptions().timeZone`); checked by the service. */
  @IsString()
  @MaxLength(64)
  timeZone!: string;

  @IsIn(['ar', 'en'])
  locale!: 'ar' | 'en';

  @IsOptional()
  @ValidateNested()
  @Type(() => PushPrefsDto)
  prefs?: PushPrefsDto;
}

export class PushEndpointDto {
  @IsUrl({ protocols: ['https'], require_protocol: true, require_tld: true })
  @MaxLength(1000)
  endpoint!: string;
}

export class PushTestDto extends PushEndpointDto {
  @IsIn(['ar', 'en'])
  locale!: 'ar' | 'en';
}
