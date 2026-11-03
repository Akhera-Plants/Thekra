/**
 * «التزام شخصي», one per habit (owner round 4): the habit's own make-up deed, chosen in the pledge sheet. Pure helpers
 * over practice-core `addPledge` / `removePledge` (which keep one pledge per plan); the deed titles are practice-core's
 * (`PLEDGE_DEED_INFO`), so the web and the app name every deed the same way.
 */

import { addPledge, pledgeDeedInfo, removePledge, type HeartData, type LocalDate, type Pledge, type PledgeAction } from '@thekra/practice-core';

export interface PledgeWordsText {
  /** «أتصدق بـ{{text}}». */
  sadaqah: (text: string) => string;
  /** «أتصدق بصدقة». */
  sadaqahPlain: string;
}

/** What the user does: the deed's title in the UI locale, «أتصدق بـ…» with the amount, or the user's own line. */
export function pledgeDeedWords(pledge: Pick<Pledge, 'action' | 'text'>, locale: 'ar' | 'en', words: PledgeWordsText): string {
  if (pledge.action === 'custom') return pledge.text ?? '';
  if (pledge.action === 'sadaqah') return pledge.text ? words.sadaqah(pledge.text) : words.sadaqahPlain;
  const info = pledgeDeedInfo(pledge.action);
  return info ? (locale === 'en' ? info.titleEn : info.titleAr) : '';
}

export function pledgeOfPlan(heart: HeartData, planId: string): Pledge | undefined {
  return heart.pledges.find((p) => p.planId === planId);
}

export interface PledgeDraft {
  action: PledgeAction;
  text: string;
}

/** Only `sadaqah` (its amount) and `custom` (the whole line) keep a text. */
export function draftText(draft: PledgeDraft): string | undefined {
  if (draft.action !== 'sadaqah' && draft.action !== 'custom') return undefined;
  const text = draft.text.trim();
  return text ? text : undefined;
}

/** A custom pledge needs its words; every other choice can be saved as is. */
export function draftReady(draft: PledgeDraft | null): draft is PledgeDraft {
  return draft !== null && (draft.action !== 'custom' || draftText(draft) !== undefined);
}

/**
 * Saves the habit's pledge (replacing its earlier one). An unchanged pledge is left as it is, so the days already kept
 * stay; a changed one starts from `today` (the misses before it never count against the new deed).
 */
export function savePlanPledge(heart: HeartData, planId: string, draft: PledgeDraft, today: LocalDate, newId: () => string): HeartData {
  const text = draftText(draft);
  const current = pledgeOfPlan(heart, planId);
  if (current && current.action === draft.action && (current.text ?? undefined) === text) return heart;
  return addPledge(heart, { id: current?.id ?? newId(), planId, action: draft.action, ...(text ? { text } : {}), createdOn: today });
}

export function removePlanPledge(heart: HeartData, planId: string): HeartData {
  const current = pledgeOfPlan(heart, planId);
  return current ? removePledge(heart, current.id) : heart;
}
