/**
 * «شعبة الأسبوع» is one choice (round 5, F-18 a with the «one setting per concept» rule): the home section
 * `week-branch` shown in «خصّص الرئيسية» (synced with the app), or the older device switch from Settings. Pure.
 */
import { resolveHomeSections, type Store } from '@thekra/practice-core';
import type { PracticePrefs } from './local-store';

export function weekBranchOn(store: Pick<Store, 'settings'>, prefs: Pick<PracticePrefs, 'weekBranch'>): boolean {
  if (prefs.weekBranch === true) return true;
  if (!store.settings.homeSections) return false;
  return resolveHomeSections(store.settings.homeSections).some((s) => s.key === 'week-branch' && s.visible);
}
