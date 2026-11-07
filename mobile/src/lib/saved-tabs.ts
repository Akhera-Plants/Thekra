/**
 * «المحفوظات» tabs (owner round 5, F-22 a): «النصوص» and «تذكيراتي», opened by `?tab=texts|reminders` (practice-core
 * nav-map `saved-texts` / `my-reminders`). The older `?part=mine` (and practice/my-reminders) still open «تذكيراتي».
 */

export type SavedTab = 'texts' | 'reminders';

export function favoritesTab(params: { tab?: string | string[]; part?: string | string[] }): SavedTab {
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  return first(params.tab) === 'reminders' || first(params.part) === 'mine' ? 'reminders' : 'texts';
}
