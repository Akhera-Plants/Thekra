/**
 * Read / unread texts (owner chat, round 6 §8): on a topic page each text shows «مقروء» or «غير مقروء» (with a filter).
 * The member's read marks are synced with the account (sync contract «Round 6»): `Store.reads`, one {@link ReadMark}
 * per Quote id, last writer wins by `updatedAt` (ties: `read: false`, so an «unread» wins over a concurrent «read» of
 * the same instant). Marking a text unread keeps its row with `read: false`, so the change reaches the other devices.
 *
 * At most {@link READS_MAX} marks are kept (the oldest dropped first; the server refuses more). Only Quote ids, never
 * a text or a topic. Pure; inputs are never mutated.
 */
import { isIsoTime, isoMillis, nowIso, type IsoTime } from './dates.js';
import type { Store } from './storage.js';

/** Marks kept per member. */
export const READS_MAX = 3000;
const QUOTE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface ReadMark {
  quoteId: string;
  read: boolean;
  /** ISO time of the edit: the last-writer-wins version. */
  updatedAt: IsoTime;
}

/** A Quote id as the API gives it (a UUID). */
export function isQuoteId(value: unknown): value is string {
  return typeof value === 'string' && QUOTE_ID.test(value);
}

/** > 0 when `a` wins: later `updatedAt`; at the same time an unread mark. */
export function compareReadMarks(a: Pick<ReadMark, 'read' | 'updatedAt'>, b: Pick<ReadMark, 'read' | 'updatedAt'>): number {
  const ta = isoMillis(a.updatedAt);
  const tb = isoMillis(b.updatedAt);
  if (ta !== tb) return ta > tb ? 1 : -1;
  if (a.read === b.read) return 0;
  return a.read ? -1 : 1;
}

/** Valid marks, one per id (the winning version), the newest {@link READS_MAX}, oldest first. Never throws. */
export function parseReadMarks(raw: unknown): ReadMark[] {
  if (!Array.isArray(raw)) return [];
  const byId = new Map<string, ReadMark>();
  for (const item of raw) {
    if (typeof item !== 'object' || item === null || Array.isArray(item)) continue;
    const r = item as Record<string, unknown>;
    if (!isQuoteId(r.quoteId) || typeof r.read !== 'boolean' || !isIsoTime(r.updatedAt)) continue;
    const mark: ReadMark = { quoteId: r.quoteId.toLowerCase(), read: r.read, updatedAt: r.updatedAt };
    const prev = byId.get(mark.quoteId);
    if (!prev || compareReadMarks(mark, prev) > 0) byId.set(mark.quoteId, mark);
  }
  const out = [...byId.values()].sort((a, b) => isoMillis(a.updatedAt) - isoMillis(b.updatedAt) || (a.quoteId < b.quoteId ? -1 : 1));
  return out.slice(Math.max(0, out.length - READS_MAX));
}

/** True when the member marked this text read (and did not mark it unread since). */
export function isRead(store: Pick<Store, 'reads'>, quoteId: string): boolean {
  const id = quoteId.toLowerCase();
  return store.reads?.find((m) => m.quoteId === id)?.read ?? false;
}

/** The ids marked read, for filtering a list. */
export function readSet(store: Pick<Store, 'reads'>): Set<string> {
  return new Set((store.reads ?? []).filter((m) => m.read).map((m) => m.quoteId));
}

/** Sets one text read or unread (stamped `now`, never older than the stored mark). Same state: no change. Throws on a bad id. */
export function setRead(store: Store, quoteId: string, read: boolean, now: IsoTime = nowIso()): Store {
  if (!isQuoteId(quoteId)) throw new RangeError('Invalid quote id');
  const id = quoteId.toLowerCase();
  const marks = store.reads ?? [];
  const existing = marks.find((m) => m.quoteId === id);
  if (existing ? existing.read === read : !read) return store;
  const at = existing && isoMillis(existing.updatedAt) >= isoMillis(now) ? new Date(isoMillis(existing.updatedAt) + 1).toISOString() : now;
  return { ...store, reads: parseReadMarks([...marks.filter((m) => m.quoteId !== id), { quoteId: id, read, updatedAt: at }]) };
}

/** «مقروء». */
export function markRead(store: Store, quoteId: string, now: IsoTime = nowIso()): Store {
  return setRead(store, quoteId, true, now);
}

/** «غير مقروء». */
export function markUnread(store: Store, quoteId: string, now: IsoTime = nowIso()): Store {
  return setRead(store, quoteId, false, now);
}
