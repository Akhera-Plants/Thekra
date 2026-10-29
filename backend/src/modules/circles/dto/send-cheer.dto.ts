import { IsIn, IsOptional, IsUUID } from 'class-validator';

/**
 * The preset encouragement lines, by key; the apps hold the wording («دعوت لك بالثبات», «جزاك الله خيرًا»,
 * «ذكّرني الله بك», and the request «ادعُ لي»). There is no free text, so nothing needs moderation.
 * `ask_dua` is what the sin program's «لحظة الضعف» sends: its wording is generic and never hints at a sin or a
 * program, and it follows the same one-per-target-per-day rule as every cheer.
 */
export const CHEER_MESSAGES = ['thabat', 'jazak', 'dhakkarani', 'ask_dua'] as const;
export type CheerMessage = (typeof CHEER_MESSAGES)[number];

/** POST /circles/:id/cheers. Without `toMemberId` the cheer goes to the whole circle. */
export class SendCheerDto {
  @IsIn(CHEER_MESSAGES)
  message!: CheerMessage;

  @IsOptional()
  @IsUUID()
  toMemberId?: string;
}
