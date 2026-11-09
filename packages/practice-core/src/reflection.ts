/**
 * Daily reflection on a habit (owner round 6, C-27 a; docs/plan/2026-11-09-owner-round-6.md §3): per habit and day,
 * two optional short answers and a day note, written on the habit page and shown in «سجلّي» when a day is opened.
 *
 * Questions (the clients own the words; the keys are here):
 * - habit: `helped` «ما الذي أعانك على الالتزام؟», `hard` «ما الذي صعّب عليك؟»;
 * - «تخفّف» program: `helped` «ما الذي أعانك على تجنّبها؟», `hard` «ما الذي صعّب عليك تركها؟» — stored on the program's
 *   check-in (`CheckIn.helped` / `CheckIn.hard` / `CheckIn.note`), so they travel ONLY inside the encrypted vault.
 *
 * Habit reflections are synced (sync contract «Round 6»): `Store.reflections`, one {@link Reflection} per (plan, date),
 * last writer wins by `updatedAt` (ties: the larger canonical JSON). A cleared reflection keeps its row with no answers,
 * so the clearing reaches the other devices. The member's own words: never logged or shown to anyone else.
 * Pure; inputs are never mutated.
 */
import { isIsoTime, isValidDate, isoMillis, nowIso, type IsoTime, type LocalDate } from './dates.js';
import type { Store } from './storage.js';

/** Characters per answer. */
export const REFLECTION_TEXT_MAX = 300;
/** The answers of a reflection, in canonical order. */
export const REFLECTION_FIELDS = ['helped', 'hard', 'note'] as const;
export type ReflectionField = (typeof REFLECTION_FIELDS)[number];
/** The two questions (both kinds of habit); `note` is the free day note. */
export const REFLECTION_QUESTIONS: readonly ReflectionField[] = ['helped', 'hard'];

export interface Reflection {
  planId: string;
  date: LocalDate;
  /** «ما الذي أعانك…؟» */
  helped?: string;
  /** «ما الذي صعّب عليك…؟» */
  hard?: string;
  /** The day note. */
  note?: string;
  /** ISO time of the last edit: the last-writer-wins version. */
  updatedAt: IsoTime;
}

export type ReflectionInput = Partial<Record<ReflectionField, string | null>>;

/** True when the reflection holds no answer (a cleared one). */
export function isEmptyReflection(r: Pick<Reflection, ReflectionField>): boolean {
  return REFLECTION_FIELDS.every((k) => r[k] === undefined);
}

/** One answer cleaned: trimmed; empty → undefined; longer than {@link REFLECTION_TEXT_MAX} → cut. */
export function cleanReflectionText(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const text = value.trim().slice(0, REFLECTION_TEXT_MAX).trim();
  return text.length > 0 ? text : undefined;
}

/** The server's check of one reflection (texts ≤ {@link REFLECTION_TEXT_MAX}); null when fine. Unknown fields ignored. */
export function validateReflectionTexts(raw: Record<string, unknown>): string | null {
  for (const k of REFLECTION_FIELDS) {
    const v = raw[k];
    if (v === undefined || v === null) continue;
    if (typeof v !== 'string' || v.length > REFLECTION_TEXT_MAX) return `${k} must be null or a string of at most ${REFLECTION_TEXT_MAX} characters`;
  }
  return null;
}

/** A copy in the canonical field order, without empty answers. */
export function cloneReflection(r: Reflection): Reflection {
  const out: Reflection = { planId: r.planId, date: r.date, updatedAt: r.updatedAt };
  for (const k of REFLECTION_FIELDS) if (r[k] !== undefined && r[k] !== '') out[k] = r[k];
  // updatedAt last, after the answers.
  const { updatedAt, ...rest } = out;
  return { ...rest, updatedAt };
}

/** Canonical JSON of the answers (the tie-breaker of {@link compareReflections}). */
export function reflectionContent(r: Pick<Reflection, ReflectionField>): string {
  const out: Record<string, string> = {};
  for (const k of REFLECTION_FIELDS) if (r[k] !== undefined) out[k] = r[k] as string;
  return JSON.stringify(out);
}

/** > 0 when `a` wins: later `updatedAt`; then the larger canonical content. */
export function compareReflections(a: Reflection, b: Reflection): number {
  const ta = isoMillis(a.updatedAt);
  const tb = isoMillis(b.updatedAt);
  if (ta !== tb) return ta > tb ? 1 : -1;
  const ca = reflectionContent(a);
  const cb = reflectionContent(b);
  return ca === cb ? 0 : ca > cb ? 1 : -1;
}

export const reflectionKey = (planId: string, date: LocalDate) => `${planId}|${date}`;

/** Valid reflections, one per (plan, date) (the winning version), sorted by date then plan. Never throws. */
export function parseReflections(raw: unknown): Reflection[] {
  if (!Array.isArray(raw)) return [];
  const byKey = new Map<string, Reflection>();
  for (const item of raw) {
    if (typeof item !== 'object' || item === null || Array.isArray(item)) continue;
    const r = item as Record<string, unknown>;
    if (typeof r.planId !== 'string' || r.planId.length === 0 || !isValidDate(r.date) || !isIsoTime(r.updatedAt)) continue;
    if (validateReflectionTexts(r) !== null) continue;
    const ref: Reflection = { planId: r.planId, date: r.date, updatedAt: r.updatedAt };
    for (const k of REFLECTION_FIELDS) {
      const text = typeof r[k] === 'string' && (r[k] as string).length > 0 ? (r[k] as string) : undefined;
      if (text !== undefined) ref[k] = text;
    }
    const clean = cloneReflection(ref);
    const key = reflectionKey(clean.planId, clean.date);
    const prev = byKey.get(key);
    if (!prev || compareReflections(clean, prev) > 0) byKey.set(key, clean);
  }
  return [...byKey.values()].sort((a, b) => (a.date !== b.date ? (a.date < b.date ? -1 : 1) : a.planId < b.planId ? -1 : a.planId > b.planId ? 1 : 0));
}

/** The reflection of a plan on a day, or null (a cleared one is null too). */
export function reflectionOf(store: Pick<Store, 'reflections'>, planId: string, date: LocalDate): Reflection | null {
  const r = store.reflections?.find((x) => x.planId === planId && x.date === date);
  return r && !isEmptyReflection(r) ? r : null;
}

/** Every non-empty reflection of a plan, newest first (the habit page and «تعلّم من الخطأ»). */
export function reflectionsOfPlan(store: Pick<Store, 'reflections'>, planId: string): Reflection[] {
  return (store.reflections ?? []).filter((r) => r.planId === planId && !isEmptyReflection(r)).sort((a, b) => (a.date < b.date ? 1 : -1));
}

/**
 * Writes the answers of one plan and day: a field given as a string sets it (an empty string or `null` clears it), a
 * field left out keeps its value. The plan must exist and the day must not be after `today`. Stamps `updatedAt = now`
 * (never older than the stored version); writing the same answers changes nothing.
 */
export function setReflection(
  store: Store,
  input: { planId: string; date: LocalDate; today: LocalDate } & ReflectionInput,
  now: IsoTime = nowIso(),
): Store {
  if (!store.plans.some((p) => p.id === input.planId)) throw new RangeError('Unknown plan');
  if (!isValidDate(input.date) || !isValidDate(input.today) || input.date > input.today) throw new RangeError('This day cannot be written');
  const list = store.reflections ?? [];
  const existing = list.find((r) => r.planId === input.planId && r.date === input.date);
  const next: Reflection = { planId: input.planId, date: input.date, updatedAt: now };
  for (const k of REFLECTION_FIELDS) {
    const v = k in input ? cleanReflectionText(input[k]) : existing?.[k];
    if (v !== undefined) next[k] = v;
  }
  if (existing ? reflectionContent(existing) === reflectionContent(next) : isEmptyReflection(next)) return store;
  if (existing && isoMillis(existing.updatedAt) >= isoMillis(now)) next.updatedAt = new Date(isoMillis(existing.updatedAt) + 1).toISOString();
  const rest = list.filter((r) => !(r.planId === input.planId && r.date === input.date));
  return { ...store, reflections: parseReflections([...rest, next]) };
}
