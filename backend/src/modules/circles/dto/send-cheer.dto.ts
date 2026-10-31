import { IsIn, IsOptional, IsUUID } from 'class-validator';

/**
 * The preset encouragement lines, by key; the apps hold the wording («دعوت لك بالثبات», «جزاك الله خيرًا»,
 * «ذكّرني الله بك»). There is no free text, so nothing needs moderation.
 */
export const CHEER_MESSAGES = ['thabat', 'jazak', 'dhakkarani'] as const;
export type CheerMessage = (typeof CHEER_MESSAGES)[number];

/** POST /circles/:id/cheers. Without `toMemberId` the cheer goes to the whole circle. */
export class SendCheerDto {
  @IsIn(CHEER_MESSAGES)
  message!: CheerMessage;

  @IsOptional()
  @IsUUID()
  toMemberId?: string;
}
