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
  type HomeSectionKey,
  type HomeSectionPref,
} from '@thekra/practice-core';

export interface HomeEditRow {
  key: HomeSectionKey;
  /** The shared section title (practice-core `HOME_SECTIONS`, the same words on the web). */
  title: string;
  visible: boolean;
  canUp: boolean;
  canDown: boolean;
}

/** The rows of the edit mode, in the draft's order. */
export function homeEditRows(draft: readonly HomeSectionPref[] | null | undefined, lang: 'ar' | 'en'): HomeEditRow[] {
  const list = resolveHomeSections(draft);
  return list.map((s, i) => {
    const info = HOME_SECTIONS.find((h) => h.key === s.key);
    return { key: s.key, title: info ? info[lang] : s.key, visible: s.visible, canUp: i > 0, canDown: i < list.length - 1 };
  });
}

/** «أعلى» (-1) / «أسفل» (+1): one step, clamped at the ends. */
export function moveSectionBy(draft: readonly HomeSectionPref[] | null | undefined, key: HomeSectionKey, delta: -1 | 1): HomeSectionPref[] {
  const list = resolveHomeSections(draft);
  const at = list.findIndex((s) => s.key === key);
  if (at < 0) return list;
  return moveHomeSection(list, key, at + delta);
}

/** The switch of one section. */
export function toggleSection(draft: readonly HomeSectionPref[] | null | undefined, key: HomeSectionKey): HomeSectionPref[] {
  const current = resolveHomeSections(draft).find((s) => s.key === key);
  return setHomeSectionVisible(draft, key, !(current?.visible ?? false));
}

/**
 * The sections to store for a member whose device had «شعبة الأسبوع» on before it moved into the home sections, or
 * null (nothing to move: the switch was off, or the member already customised the page).
 */
export function weekBranchMigration(stored: readonly HomeSectionPref[] | undefined, weekBranchPref: boolean): HomeSectionPref[] | null {
  if (!weekBranchPref || stored !== undefined) return null;
  return setHomeSectionVisible(null, 'week-branch', true);
}
