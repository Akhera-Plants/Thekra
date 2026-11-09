/**
 * «خصّص الرئيسية» (owner round 5, F-02 a): the edit mode of the home page for a member: one row per section with its
 * switch and «أعلى» / «أسفل», on a draft that is saved with practice-core `setHomeSections` (so it syncs with the
 * account and the website shows the same order). A visitor never edits: the home page keeps its fixed order.
 *
 * Also the one-time move of the device-local «شعبة الأسبوع» switch (`prefs.weekBranch`, round 3) into the synced
 * sections: shown when the member had turned it on and has not customised the page yet.
 *
 * Pure.
 */

import {
  HOME_SECTIONS,
  moveHomeSection,
  resolveHomeSections,
  setHomeSectionVisible,
  visibleHomeSections,
  type HomeSectionKey,
  type HomeSectionPref,
} from '@thekra/practice-core';

/** Sections the app no longer shows (round 6, C-01q: «نص اليوم» and its source picker are removed). */
export const REMOVED_SECTIONS: readonly HomeSectionKey[] = ['daily-text'];

/**
 * The home page's sections, in order (round 6, C-11): a member who never customised the page sees the short «ورد اليوم»
 * and then the doors right away; a visitor sees the doors first. A member's own order is kept as stored. «نص اليوم» is
 * never shown (C-01q). The rest follows practice-core `visibleHomeSections`.
 */
export function homeSectionsFor(stored: readonly HomeSectionPref[] | null | undefined, member: boolean): HomeSectionKey[] {
  const keys = visibleHomeSections(stored, member).filter((k) => !REMOVED_SECTIONS.includes(k));
  if (member && stored && stored.length > 0) return keys;
  const lead: HomeSectionKey[] = member ? ['wird', 'doors'] : ['doors'];
  return [...lead.filter((k) => keys.includes(k)), ...keys.filter((k) => !lead.includes(k))];
}

export interface HomeEditRow {
  key: HomeSectionKey;
  /** The shared section title (practice-core `HOME_SECTIONS`, the same words on the web). */
  title: string;
  visible: boolean;
  canUp: boolean;
  canDown: boolean;
}

/**
 * The full list the edit mode works on: the draft, or (never customised) the app's default order with the doors right
 * after «ورد اليوم» (C-11), so what the sheet shows is what the page shows.
 */
export function editableSections(draft: readonly HomeSectionPref[] | null | undefined): HomeSectionPref[] {
  const list = resolveHomeSections(draft);
  if (draft && draft.length > 0) return list;
  const doors = list.find((s) => s.key === 'doors');
  if (!doors) return list;
  const rest = list.filter((s) => s.key !== 'doors');
  const at = rest.findIndex((s) => s.key === 'wird') + 1;
  return [...rest.slice(0, at), doors, ...rest.slice(at)];
}

/** The rows of the edit mode, in the draft's order. */
export function homeEditRows(draft: readonly HomeSectionPref[] | null | undefined, lang: 'ar' | 'en'): HomeEditRow[] {
  const list = editableSections(draft).filter((s) => !REMOVED_SECTIONS.includes(s.key));
  return list.map((s, i) => {
    const info = HOME_SECTIONS.find((h) => h.key === s.key);
    return { key: s.key, title: info ? info[lang] : s.key, visible: s.visible, canUp: i > 0, canDown: i < list.length - 1 };
  });
}

/** «أعلى» (-1) / «أسفل» (+1): one step, clamped at the ends. */
export function moveSectionBy(draft: readonly HomeSectionPref[] | null | undefined, key: HomeSectionKey, delta: -1 | 1): HomeSectionPref[] {
  const list = editableSections(draft);
  const shown = list.filter((s) => !REMOVED_SECTIONS.includes(s.key));
  const neighbour = shown[shown.findIndex((s) => s.key === key) + delta];
  if (!shown.some((s) => s.key === key) || !neighbour) return list;
  // Removed sections stay in the stored list (the web may still read it) but never block a step.
  return moveHomeSection(list, key, list.findIndex((s) => s.key === neighbour.key));
}

/** The switch of one section. */
export function toggleSection(draft: readonly HomeSectionPref[] | null | undefined, key: HomeSectionKey): HomeSectionPref[] {
  const list = editableSections(draft);
  const current = list.find((s) => s.key === key);
  return setHomeSectionVisible(list, key, !(current?.visible ?? false));
}

/**
 * The sections to store for a member whose device had «شعبة الأسبوع» on before it moved into the home sections, or
 * null (nothing to move: the switch was off, or the member already customised the page).
 */
export function weekBranchMigration(stored: readonly HomeSectionPref[] | undefined, weekBranchPref: boolean): HomeSectionPref[] | null {
  if (!weekBranchPref || stored !== undefined) return null;
  return setHomeSectionVisible(null, 'week-branch', true);
}
