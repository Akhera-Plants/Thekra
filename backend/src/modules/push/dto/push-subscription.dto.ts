import { Type } from 'class-transformer';
import { STRATEGY_KEYS } from '@thekra/practice-core';
import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsOptional, IsString, IsUrl, Matches, MaxLength, ValidateNested } from 'class-validator';

const BASE64URL = /^[A-Za-z0-9_-]+={0,2}$/;
const HH_MM = /^([01]\d|2[0-3]):[0-5]\d$/;

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
  /** «ذكّرني بها»: chosen strategy keys (practice-core `STRATEGY_KEYS`); one reminder a week at most. */
  @IsOptional() @IsArray() @ArrayMaxSize(STRATEGY_KEYS.length) @IsIn(STRATEGY_KEYS, { each: true }) strategies?: string[];
  @IsOptional() @IsString() @Matches(HH_MM) strategyTime?: string;
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
