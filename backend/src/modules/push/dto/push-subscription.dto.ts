import { Type } from 'class-transformer';
import { IsIn, IsString, IsUrl, Matches, MaxLength, ValidateNested } from 'class-validator';

const BASE64URL = /^[A-Za-z0-9_-]+={0,2}$/;

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
