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
