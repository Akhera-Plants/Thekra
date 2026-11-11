/**
 * Removing what is personal from this browser (sign-out, account deletion, another account signing in): the practice
 * store with the sealed «تخفَّف» programs and their key, the heart data (intentions, reviews, messages to oneself,
 * pledges), «تذكيراتي» and unsent review drafts. Prayer-time settings and display preferences are not personal data
 * and stay.
 */
import { wipeHeart } from './heart-store';
import { wipeLocalPractice } from './local-store';
import { clearReviewDrafts } from './review-draft';
import { myRemindersStore } from './screen-stores';

export async function wipeAllLocalPractice(): Promise<void> {
  wipeHeart();
  myRemindersStore.clear();
  clearReviewDrafts();
  await wipeLocalPractice();
}
