/**
 * «المحفوظات» tabs (owner round 5, F-22 a): «النصوص» and «تذكيراتي», each at its own address from the shared navigation
 * map (`saved-texts` → `/favorites`, `my-reminders` → `/favorites/reminders`). Pure.
 */
import { navFeature } from '@thekra/practice-core';

export type SavedTab = 'texts' | 'reminders';

export const SAVED_TAB_ROUTES: Record<SavedTab, string> = {
  texts: navFeature('saved-texts')?.web ?? '/favorites',
  reminders: navFeature('my-reminders')?.web ?? '/favorites/reminders',
};
