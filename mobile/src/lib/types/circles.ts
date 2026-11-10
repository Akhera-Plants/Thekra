/**
 * صحبة (/v1/circles) shapes, mirroring backend/src/modules/circles/entities/circle.entity.ts. Members are known by
 * their member id only; the API never sends a user id or an email.
 */

/**
 * Round 7 (D6): the suggested lines by what the صحبة is for, as the API keys them (backend companion.dto.ts). The
 * words are in `circles.lines` (to the whole صحبة) and `circles.linesTo` (to one member).
 */
export const PRESET_GROUPS = {
  progress: ['progress', 'steady', 'back'],
  encourage: ['thabat', 'jazak', 'dhakkarani', 'keep_going'],
  support: ['ask_dua', 'ask_remind', 'ask_join', 'ask_heavy'],
  remind: ['thabbatak', 'niyya', 'dont_break'],
} as const;
export type PresetGroup = keyof typeof PRESET_GROUPS;
export type PresetKey = (typeof PRESET_GROUPS)[PresetGroup][number];
export const PRESET_GROUP_KEYS: readonly PresetGroup[] = ['progress', 'encourage', 'support', 'remind'];
/** Groups whose lines may go to one member; the others speak about the sender and go to the whole صحبة. */
export const DIRECTED_GROUPS: readonly PresetGroup[] = ['encourage', 'remind'];

/** Round 7 (D5). */
export const ROUND_KINDS = ['study', 'focus', 'habit', 'reading', 'listening', 'task', 'sport'] as const;
export type RoundKind = (typeof ROUND_KINDS)[number];
export const ROUND_MINUTE_PRESETS = [15, 25, 30, 45, 60] as const;
export const ROUND_MINUTES_MAX = 240;
export const ROUND_LABEL_MAX = 60;
export const ROUND_CHEERS = ['go', 'with_you', 'next_time'] as const;
export const ROUND_CONGRATS = ['mashallah', 'barak', 'zadak'] as const;
export type RoundReplyKey = (typeof ROUND_CHEERS)[number] | (typeof ROUND_CONGRATS)[number];

/** Round 7 (D8). */
export const REPORT_REASONS = ['offensive', 'harassment', 'inappropriate', 'spam', 'other'] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];
export const REPORT_NOTE_MAX = 300;

/** A line to the whole صحبة targets this key in `sentToday`. */
export const WHOLE_CIRCLE = 'circle';

/** The API's limits (backend circles DTOs and service). */
export const CIRCLE_TEXT_MAX = { name: 40, intention: 120, displayName: 30 } as const;
export const CIRCLES_PER_USER_MAX = 5;

export interface CircleSummary {
  id: string;
  name: string;
  intention: string | null;
  memberCount: number;
  isOwner: boolean;
  displayName: string;
  sharesPresence: boolean;
}

export interface CircleMember {
  memberId: string;
  displayName: string;
  isOwner: boolean;
  isMe: boolean;
  presentDays: string[];
}

export interface CircleRound {
  id: string;
  memberId: string;
  memberName: string;
  isMine: boolean;
  kind: RoundKind;
  label: string | null;
  minutes: number;
  /** «الجولة n اليوم». */
  number: number;
  startedAt: string;
  endsAt: string;
  outcome: 'done' | 'not_done' | null;
  /** Ended, or forgotten past its time. */
  closed: boolean;
  /** Reply keys I already sent to it. */
  myReplies: string[];
}

export type CircleMessageKind = 'preset' | 'round_start' | 'round_end' | 'reply';

export interface CircleMessage {
  id: string;
  kind: CircleMessageKind;
  key: string | null;
  from: { memberId: string; name: string; isMe: boolean };
  /** Null: to the whole صحبة. */
  to: { memberId: string; name: string; isMe: boolean } | null;
  progress: { done: number; total: number } | null;
  round: CircleRound | null;
  saved: boolean;
  createdAt: string;
}

export interface CircleMessagesPage {
  items: CircleMessage[];
  nextBefore: string | null;
}

export interface CircleDetail {
  id: string;
  name: string;
  intention: string | null;
  memberCount: number;
  maxMembers: number;
  inviteCode: string | null;
  me: { memberId: string; displayName: string; isOwner: boolean; sharesPresence: boolean };
  days: string[];
  members: CircleMember[];
  /** My round still running in this صحبة. */
  myOpenRound: CircleRound | null;
  /** Lines I sent today, `key:target` (`target` is a member id or `circle`). */
  sentToday: string[];
  /** Members whose messages I hid. */
  mutedMemberIds: string[];
}

export interface CreateCircleInput {
  name: string;
  intention?: string;
  displayName: string;
}

export interface JoinCircleInput {
  code: string;
  displayName: string;
}

export interface UpdateMembershipInput {
  displayName?: string;
  sharesPresence?: boolean;
}

export interface SendMessageInput {
  key: PresetKey;
  toMemberId?: string;
  progress?: { done: number; total: number };
}

export interface StartRoundInput {
  kind: RoundKind;
  label?: string;
  minutes: number;
  /** The device's local date. */
  today: string;
}

export interface ReportInput {
  kind: 'member' | 'message';
  memberId?: string;
  messageId?: string;
  reason: ReportReason;
  note?: string;
  mute?: boolean;
}

/** GET /circles/access (round 6, C-01k): whether صحبة is on for me, and how many invites I can still give. */
export interface CircleAccess {
  enabled: boolean;
  /** In at least one circle now (the website uses it for «شارك تطورك مع الصحبة»; the app reads its circle list). */
  inCircle?: boolean;
  invites: {
    active: number;
    activeMax: number;
    createdInPeriod: number;
    periodMax: number;
    periodDays: number;
    /** What I can create now (both limits applied). */
    remaining: number;
    /** Days an invite works. */
    ttlDays: number;
  } | null;
}

export type CircleInviteStatus = 'active' | 'redeemed' | 'revoked' | 'expired';

/** One of my invites. It never says who redeemed it. */
export interface CircleInvite {
  id: string;
  /** Only while `status` is `active`. */
  code: string | null;
  status: CircleInviteStatus;
  circle: { id: string; name: string } | null;
  expiresAt: string;
  createdAt: string;
}

export interface RedeemInviteResult {
  enabled: true;
  circle: CircleDetail | null;
  joinError: string | null;
}
