import type { ReportReason, RoundKind } from '../dto/companion.dto.js';

/**
 * Response shapes of /circles. Members are addressed by their member id only: no user id, no email, ever.
 */

/** One row of GET /circles. */
export interface CircleSummaryDto {
  id: string;
  name: string;
  intention: string | null;
  memberCount: number;
  isOwner: boolean;
  displayName: string;
  sharesPresence: boolean;
}

export interface CircleMemberDto {
  memberId: string;
  displayName: string;
  isOwner: boolean;
  isMe: boolean;
  /** Dates among `days` on which the member logged something; empty when the member does not share. */
  presentDays: string[];
}

/** D5: a round, as the feed and the circle show it. */
export interface CircleRoundDto {
  id: string;
  memberId: string;
  memberName: string;
  isMine: boolean;
  kind: RoundKind;
  label: string | null;
  minutes: number;
  /** «الجولة n اليوم» of its member. */
  number: number;
  startedAt: string;
  /** startedAt + minutes. */
  endsAt: string;
  outcome: 'done' | 'not_done' | null;
  /** Ended with an outcome, or left open past its time and the grace period. */
  closed: boolean;
  /** Reply keys I already sent to this round. */
  myReplies: string[];
}

export type CircleMessageKindDto = 'preset' | 'round_start' | 'round_end' | 'reply';

/** D7: one line of the feed. Only `round.label` was typed by a person; every other word is the apps'. */
export interface CircleMessageDto {
  id: string;
  kind: CircleMessageKindDto;
  /** The preset or reply key; null for round_start / round_end. */
  key: string | null;
  from: { memberId: string; name: string; isMe: boolean };
  /** Null: to the whole صحبة. */
  to: { memberId: string; name: string; isMe: boolean } | null;
  progress: { done: number; total: number } | null;
  round: CircleRoundDto | null;
  saved: boolean;
  createdAt: string;
}

/** GET /circles/:id/messages */
export interface CircleMessagesPageDto {
  items: CircleMessageDto[];
  /** Pass as `before` for older messages; null at the start. */
  nextBefore: string | null;
}

export interface CircleReportResultDto {
  received: true;
  muted: boolean;
}

/** GET /admin/circle-reports: one report, for the owner of Thekra. */
export interface AdminCircleReportDto {
  id: string;
  kind: 'member' | 'message';
  reason: ReportReason;
  note: string | null;
  createdAt: string;
  circle: { id: string | null; name: string };
  reporter: { userId: string | null; name: string };
  reported: { userId: string | null; memberId: string | null; name: string; stillMember: boolean };
  /** Message reports: what it said (kind, key, round kind/label/minutes, progress). */
  message: { id: string | null; snapshot: unknown } | null;
  /** All reports about the same account (or the same member when the account is gone). */
  reportsAboutSame: number;
}

/** GET /circles/:id (and the create / join responses). */
export interface CircleDetailDto {
  id: string;
  name: string;
  intention: string | null;
  memberCount: number;
  maxMembers: number;
  /** Only for the owner. */
  inviteCode: string | null;
  me: { memberId: string; displayName: string; isOwner: boolean; sharesPresence: boolean };
  /** The last 7 local dates, oldest first, ending on the viewer's today. */
  days: string[];
  members: CircleMemberDto[];
  /** D5: my round that is still running in this صحبة (the end buttons show for it). */
  myOpenRound: CircleRoundDto | null;
  /** D6: suggested lines I sent today (server UTC day), as `key:target` (`target` is a member id or `circle`). */
  sentToday: string[];
  /** D8: members whose messages I hid from my feed. */
  mutedMemberIds: string[];
}

/**
 * GET /circles/access: whether صحبة is on for me, whether I am in a circle now (so «شارك تطورك مع الصحبة» shows only
 * to a member of one, on the website as in the app), and (when it is on) how many invites I can still give.
 */
export interface CircleAccessDto {
  enabled: boolean;
  /** True when I belong to at least one circle (always false while صحبة is off). */
  inCircle: boolean;
  invites: {
    /** Unused, unexpired invites I hold now. */
    active: number;
    activeMax: number;
    /** Invites I created in the last `periodDays` days. */
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
export interface CircleInviteDto {
  id: string;
  /** Only while `status` is `active`. */
  code: string | null;
  status: CircleInviteStatus;
  /** The circle the invite also joins, if any. */
  circle: { id: string; name: string } | null;
  expiresAt: string;
  createdAt: string;
}

/** POST /circles/invites/redeem. */
export interface RedeemCircleInviteResultDto {
  enabled: true;
  /** The circle joined through the invite. */
  circle: CircleDetailDto | null;
  /** Why the invite's circle was not joined: CIRCLE_FULL, CIRCLE_LIMIT_REACHED or CIRCLE_INVITE_CIRCLE_GONE. */
  joinError: string | null;
}
