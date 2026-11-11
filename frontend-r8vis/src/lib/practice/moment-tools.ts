/**
 * «لحظة مجاهدة» acts per sin (owner round 5, F-09; catalog `sinPrograms.moment`, backend sin-programs.yaml): the acts
 * tied to the texts for the user's sin, an alias's acts, or the generic acts for every other sin (and when no sin is
 * known). The same choice as the app (mobile/src/lib/practice/moment-tools.ts). Pure.
 *
 * Privacy: the page asks the evidence of EVERY act at once (`allMomentEvidenceIds`), so the request is the same for
 * every member and tells nothing about the sin; the sin itself is only read on this device.
 */
import type { MomentTool, MomentTools } from '@/lib/types/practice';

export interface MomentChoice {
  tools: MomentTool[];
  /** True when the acts are the sin's own (or an alias's), false for the generic acts. */
  own: boolean;
}

/** The acts for `sinSlug` (null: no sin known), else the generic ones. */
export function momentToolsFor(moment: MomentTools | undefined, sinSlug: string | null | undefined): MomentChoice {
  if (!moment) return { tools: [], own: false };
  if (sinSlug) {
    const own = moment.sins[sinSlug] ?? moment.sins[moment.aliases?.[sinSlug] ?? ''];
    if (own && own.length > 0) return { tools: own, own: true };
  }
  return { tools: moment.generic, own: false };
}

/** The API takes at most 50 ids a request (`GET /v1/practice/evidence`, backend `MAX_EVIDENCE_IDS`). */
export const EVIDENCE_BATCH = 50;

/** `ids` in fixed batches of {@link EVIDENCE_BATCH}, in their order: the same batches for every member asking the same list. */
export function evidenceBatches(ids: readonly string[]): string[][] {
  const out: string[][] = [];
  for (let i = 0; i < ids.length; i += EVIDENCE_BATCH) out.push(ids.slice(i, i + EVIDENCE_BATCH));
  return out;
}

/** Every evidence id of every act (generic and per sin), sorted and unique: one public request for all members. */
export function allMomentEvidenceIds(moment: MomentTools | undefined): string[] {
  if (!moment) return [];
  const ids = new Set<string>();
  for (const tool of [...moment.generic, ...Object.values(moment.sins).flat()]) tool.evidence.forEach((id) => ids.add(id));
  return [...ids].sort();
}
