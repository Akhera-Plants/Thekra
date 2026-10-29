/**
 * رفقة (/v1/circles) shapes, mirroring backend/src/modules/circles/entities/circle.entity.ts. Members are known by
 * their member id only; the API never sends a user id or an email.
 */

/** `ask_dua` («ادعُ لي») is sent from the sin program's «لحظة الضعف»; it shows here like any cheer received. */
export type CheerMessage = 'thabat' | 'jazak' | 'dhakkarani' | 'ask_dua';

/** The lines offered in «أرسل كلمة طيبة» (the request «ادعُ لي» is not among them). */
export const CHEER_MESSAGES: readonly CheerMessage[] = ['thabat', 'jazak', 'dhakkarani'];

/** A cheer to the whole circle targets this key in `cheeredToday`. */
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

export interface CircleCheer {
  id: string;
  message: CheerMessage;
  fromMemberId: string;
  fromName: string;
  toMe: boolean;
  createdAt: string;
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
  cheers: CircleCheer[];
  cheeredToday: string[];
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

export interface SendCheerInput {
  message: CheerMessage;
  toMemberId?: string;
}
