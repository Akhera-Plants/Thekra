import type { CheerMessage } from '../dto/send-cheer.dto.js';

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

export interface CircleCheerDto {
  id: string;
  message: CheerMessage;
  fromMemberId: string;
  fromName: string;
  /** False when the cheer went to the whole circle. */
  toMe: boolean;
  createdAt: string;
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
  /** The latest cheers to me or to the whole circle, newest first. */
  cheers: CircleCheerDto[];
  /** Targets I already cheered today (member ids, or `circle`): one cheer per target per day. */
  cheeredToday: string[];
}

/**
 * GET /circles/access: whether رفقة is on for me, whether I am in a circle now (so «شارك تطورك مع الرفقة» shows only
 * to a member of one, on the website as in the app), and (when it is on) how many invites I can still give.
 */
export interface CircleAccessDto {
  enabled: boolean;
  /** True when I belong to at least one circle (always false while رفقة is off). */
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
