/**
 * UI strings. The single source is `_locales/<lang>/messages.json` (also used by the manifest through
 * `__MSG_extName__`). They are bundled here so the user's chosen language works in the popup and the
 * service worker alike (chrome.i18n would follow the browser language instead). `$1`…`$9` are replaced by
 * the arguments. Numbers are passed in as Western digits.
 */
import arMessages from '../_locales/ar/messages.json';
import enMessages from '../_locales/en/messages.json';
import type { Translate } from './quotes.js';
import type { Lang } from './state.js';

type Messages = Record<string, { message: string }>;

const TABLES: Record<Lang, Messages> = { ar: arMessages as Messages, en: enMessages as Messages };

export function translator(lang: Lang): Translate {
  const table = TABLES[lang];
  return (key, ...subs) => {
    const entry = table[key] ?? TABLES.ar[key];
    if (!entry) return key;
    return entry.message.replace(/\$([1-9])/g, (_, n: string) => subs[Number(n) - 1] ?? '');
  };
}

export function messageKeys(lang: Lang): string[] {
  return Object.keys(TABLES[lang]);
}
