import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

/**
 * Round 7 «صحبة» (docs/plan/2026-11-10-owner-round-7.md, D5–D8). Every line a member sends is a key the apps word in
 * both languages; the one free text is a round's short label. Nothing here is moderated by a person before it shows,
 * so nothing else can carry words.
 */

/**
 * D6: the suggested lines, by what the صحبة is for. `progress` carries the sender's habits of the day as two counts
 * (never a habit's name, never the sin program). The first three keys of `encourage` are the round-6 cheers.
 */
export const PRESET_GROUPS = {
  progress: ['progress', 'steady', 'back'],
  encourage: ['thabat', 'jazak', 'dhakkarani', 'keep_going'],
  support: ['ask_dua', 'ask_remind', 'ask_join', 'ask_heavy'],
  remind: ['thabbatak', 'niyya', 'dont_break'],
} as const;
export type PresetGroup = keyof typeof PRESET_GROUPS;
export type PresetKey = (typeof PRESET_GROUPS)[PresetGroup][number];
export const PRESET_KEYS: readonly PresetKey[] = Object.values(PRESET_GROUPS).flat();
/** Groups whose lines may go to one member; the others speak about the sender and go to the whole صحبة. */
export const DIRECTED_GROUPS: readonly PresetGroup[] = ['encourage', 'remind'];

export function presetGroupOf(key: string): PresetGroup | null {
  for (const [group, keys] of Object.entries(PRESET_GROUPS) as [PresetGroup, readonly string[]][]) {
    if (keys.includes(key)) return group;
  }
  return null;
}

/** D5: what a round is for. «عادة» needs not be one of the member's habits (owner: «عادي لو ما كانت ضمن العادات»). */
export const ROUND_KINDS = ['study', 'focus', 'habit', 'reading', 'listening', 'task', 'sport'] as const;
export type RoundKind = (typeof ROUND_KINDS)[number];
export const ROUND_LABEL_MAX = 60;
export const ROUND_MINUTES_MAX = 240;

/** D5: preset replies to someone's round: encouragement while it runs or after «لم يتم», congratulations after «تم». */
export const ROUND_CHEERS = ['go', 'with_you', 'next_time'] as const;
export const ROUND_CONGRATS = ['mashallah', 'barak', 'zadak'] as const;
export type RoundReplyKey = (typeof ROUND_CHEERS)[number] | (typeof ROUND_CONGRATS)[number];

/** D8 */
export const REPORT_REASONS = ['offensive', 'harassment', 'inappropriate', 'spam', 'other'] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];
export const REPORT_NOTE_MAX = 300;

/** Control characters (new line included) and bidi overrides/isolates/marks are removed from a typed label. */
const UNSAFE_LABEL_CHARS = /[\p{Cc}‎‏‪-‮⁦-⁩]/gu;
/** The note keeps new lines and tabs; the rest as above. */
const UNSAFE_NOTE_CHARS = /[^\P{Cc}\n\t]|[‎‏‪-‮⁦-⁩]/gu;

/** A round's label as stored: unsafe characters removed, spaces collapsed, trimmed; empty → undefined. */
export function cleanRoundLabel(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const cleaned = value.replace(UNSAFE_LABEL_CHARS, ' ').replace(/\s+/g, ' ').trim();
  return cleaned.length > 0 ? cleaned : undefined;
}

export function cleanReportNoteText(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const cleaned = value.replace(UNSAFE_NOTE_CHARS, '').replace(/\n{3,}/g, '\n\n').trim();
  return cleaned.length > 0 ? cleaned : undefined;
}

const LOCAL_DATE = /^\d{4}-\d{2}-\d{2}$/;

export class ProgressDto {
  @IsInt()
  @Min(0)
  @Max(30)
  done!: number;

  @IsInt()
  @Min(1)
  @Max(30)
  total!: number;
}

/** POST /circles/:id/messages: a suggested line, to the whole صحبة or (encourage / remind) to one member. */
export class SendMessageDto {
  @IsIn(PRESET_KEYS)
  key!: PresetKey;

  @IsOptional()
  @IsUUID()
  toMemberId?: string;

  /** Required with `progress`, refused with any other key (the service checks). */
  @IsOptional()
  @ValidateNested()
  @Type(() => ProgressDto)
  progress?: ProgressDto;
}

/** POST /circles/:id/rounds */
export class StartRoundDto {
  @IsIn(ROUND_KINDS)
  kind!: RoundKind;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => cleanRoundLabel(value))
  @IsString()
  @MinLength(1)
  @MaxLength(ROUND_LABEL_MAX)
  label?: string;

  @IsInt()
  @Min(1)
  @Max(ROUND_MINUTES_MAX)
  minutes!: number;

  /** The member's local date: «الجولة n اليوم» counts on it. Server today ±1 day. */
  @IsString()
  @Matches(LOCAL_DATE)
  today!: string;
}

/** POST /circles/:id/rounds/:roundId/end: «تم الحمد لله» or «لم يتم». */
export class EndRoundDto {
  @IsIn(['done', 'not_done'])
  outcome!: 'done' | 'not_done';
}

/** POST /circles/:id/rounds/:roundId/replies */
export class ReplyRoundDto {
  @IsIn([...ROUND_CHEERS, ...ROUND_CONGRATS])
  key!: RoundReplyKey;
}

/** GET /circles/:id/messages: newest first, `limit` at a time, older ones with `before` (a message id). */
export class MessagesQueryDto {
  @IsOptional()
  @IsUUID()
  before?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;

  /** «المحفوظة»: only the messages I kept. */
  @IsOptional()
  @IsIn(['true', 'false'])
  saved?: 'true' | 'false';
}

/** POST /circles/:id/reports: a member, or one message (its sender is the member reported). */
export class ReportDto {
  @IsIn(['member', 'message'])
  kind!: 'member' | 'message';

  @IsOptional()
  @IsUUID()
  memberId?: string;

  @IsOptional()
  @IsUUID()
  messageId?: string;

  @IsIn(REPORT_REASONS)
  reason!: ReportReason;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => cleanReportNoteText(value))
  @IsString()
  @MaxLength(REPORT_NOTE_MAX)
  note?: string;

  /** Also hide that member's messages from my feed now. */
  @IsOptional()
  @IsBoolean()
  mute?: boolean;
}

/** GET /admin/circle-reports */
export class AdminCircleReportsQueryDto {
  @IsOptional()
  @IsUUID()
  before?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
