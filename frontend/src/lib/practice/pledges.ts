import { pledgeDeedInfo, type Pledge, type PledgeAction } from '@thekra/practice-core';

/** The `practice.heart.pledge` messages a pledge's words need. */
export type PledgeWordsT = (key: 'sadaqah' | 'sadaqahPlain', values?: Record<string, string>) => string;

/**
 * The words of a pledge's deed, as the app says them: a listed deed's title (practice-core `PLEDGE_DEED_INFO`, the same
 * in both clients), «أتصدق بـ<amount>», or the user's own line.
 */
export function pledgeActionText(action: PledgeAction, text: string | undefined, english: boolean, t: PledgeWordsT): string {
  if (action === 'custom') return text ?? '';
  if (action === 'sadaqah') return text ? t('sadaqah', { text }) : t('sadaqahPlain');
  const info = pledgeDeedInfo(action);
  return info ? (english ? info.titleEn : info.titleAr) : '';
}

export function pledgeText(pledge: Pledge, english: boolean, t: PledgeWordsT): string {
  return pledgeActionText(pledge.action, pledge.text, english, t);
}

/**
 * A habit title quoted for a sentence: «…» in Arabic, “…” in English. A title that already carries quotation marks
 * (a catalog title such as «سبحان الله وبحمده» صباحًا ومساءً) is left as it is, so the marks never double.
 */
export function quotedTitle(title: string, english: boolean): string {
  if (/[«»“”"]/.test(title)) return title;
  return english ? `“${title}”` : `«${title}»`;
}
