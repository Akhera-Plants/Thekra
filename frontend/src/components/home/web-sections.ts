import { HOME_SECTIONS, parseHomeSections, resolveHomeSections, type HomeSectionKey, type HomeSectionPref } from '@thekra/practice-core';

/**
 * The home sections the website draws. «نص اليوم» is gone from both platforms (owner round 6, C-01q), so it is never
 * drawn nor offered in «خصّص الرئيسية» (which lives in the settings only, C-04). The key stays in practice-core for
 * stored orders.
 */
export const WEB_HOME_SECTIONS: readonly HomeSectionKey[] = HOME_SECTIONS.map((s) => s.key).filter((key) => key !== 'daily-text');

/**
 * The member's order as the website draws it and as «خصّص الرئيسية» lists it. A member who never customised the page
 * gets the doors right after the short «ورد اليوم» (owner round 6, C-11: nothing parts the wird from the doors in the
 * default); a stored order is used as it is. Web-only sections are dropped.
 */
export function webHomeOrder(stored: readonly HomeSectionPref[] | null | undefined): HomeSectionPref[] {
  const list = resolveHomeSections(stored).filter((s) => WEB_HOME_SECTIONS.includes(s.key));
  if (parseHomeSections(stored ?? null)) return list;
  const doors = list.findIndex((s) => s.key === 'doors');
  const wird = list.findIndex((s) => s.key === 'wird');
  if (doors < 0 || wird < 0 || doors === wird + 1) return list;
  const [moved] = list.splice(doors, 1);
  list.splice(list.findIndex((s) => s.key === 'wird') + 1, 0, moved as HomeSectionPref);
  return list;
}
