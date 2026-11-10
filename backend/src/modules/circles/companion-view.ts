import type { CircleMessageKind, CircleRoundOutcome, Prisma } from '@prisma/client';
import { ROUND_MINUTES_MAX, type RoundKind } from './dto/companion.dto.js';
import type { CircleMessageDto, CircleMessageKindDto, CircleRoundDto } from './entities/circle.entity.js';

/**
 * Round 7 «صحبة»: pure pieces shared by the circle and its feed (rounds, messages). No database access here.
 */

/** A round left without «تم» / «لم يتم» stops counting as running this long after its time is up. */
export const ROUND_GRACE_MS = 6 * 3_600_000;
/** Started earlier than this, a round cannot be running any more (the longest round plus the grace period). */
export const ROUND_MAX_OPEN_MS = ROUND_MINUTES_MAX * 60_000 + ROUND_GRACE_MS;

export function roundEndsAt(round: { startedAt: Date; minutes: number }): Date {
  return new Date(round.startedAt.getTime() + round.minutes * 60_000);
}

/** Ended, or past its time and the grace period. */
export function isRoundClosed(round: { startedAt: Date; minutes: number; endedAt: Date | null }, now: Date): boolean {
  return round.endedAt !== null || roundEndsAt(round).getTime() + ROUND_GRACE_MS <= now.getTime();
}

const OUTCOME: Record<CircleRoundOutcome, 'done' | 'not_done'> = { DONE: 'done', NOT_DONE: 'not_done' };
const KIND: Record<CircleMessageKind, CircleMessageKindDto> = {
  PRESET: 'preset',
  ROUND_START: 'round_start',
  ROUND_END: 'round_end',
  REPLY: 'reply',
};

export interface RoundRow {
  id: string;
  memberId: string;
  kind: string;
  label: string | null;
  minutes: number;
  number: number;
  startedAt: Date;
  endedAt: Date | null;
  outcome: CircleRoundOutcome | null;
  member: { displayName: string };
  /** My REPLY messages to this round. */
  messages?: { key: string | null }[];
}

export function toRoundDto(round: RoundRow, meId: string, now: Date): CircleRoundDto {
  return {
    id: round.id,
    memberId: round.memberId,
    memberName: round.member.displayName,
    isMine: round.memberId === meId,
    kind: round.kind as RoundKind,
    label: round.label,
    minutes: round.minutes,
    number: round.number,
    startedAt: round.startedAt.toISOString(),
    endsAt: roundEndsAt(round).toISOString(),
    outcome: round.outcome ? OUTCOME[round.outcome] : null,
    closed: isRoundClosed(round, now),
    myReplies: (round.messages ?? []).map((m) => m.key).filter((k): k is string => k !== null),
  };
}

/** The round include for a viewer: its member's name and the viewer's own replies to it. */
export function roundInclude(meId: string) {
  return {
    member: { select: { displayName: true } },
    messages: { where: { kind: 'REPLY' as const, senderId: meId }, select: { key: true } },
  } satisfies Prisma.CircleRoundInclude;
}

export interface MessageRow {
  id: string;
  kind: CircleMessageKind;
  key: string | null;
  senderId: string;
  receiverId: string | null;
  data: Prisma.JsonValue | null;
  createdAt: Date;
  sender: { displayName: string };
  receiver: { displayName: string } | null;
  round: RoundRow | null;
  saves: { memberId: string }[];
}

function progressOf(data: Prisma.JsonValue | null): { done: number; total: number } | null {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  const { done, total } = data as { done?: unknown; total?: unknown };
  return typeof done === 'number' && typeof total === 'number' ? { done, total } : null;
}

export function toMessageDto(row: MessageRow, meId: string, now: Date): CircleMessageDto {
  return {
    id: row.id,
    kind: KIND[row.kind],
    key: row.key,
    from: { memberId: row.senderId, name: row.sender.displayName, isMe: row.senderId === meId },
    to:
      row.receiverId && row.receiver
        ? { memberId: row.receiverId, name: row.receiver.displayName, isMe: row.receiverId === meId }
        : null,
    progress: progressOf(row.data),
    round: row.round ? toRoundDto(row.round, meId, now) : null,
    saved: row.saves.length > 0,
    createdAt: row.createdAt.toISOString(),
  };
}
