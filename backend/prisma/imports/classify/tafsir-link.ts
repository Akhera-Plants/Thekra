/**
 * Al-Sa'di supports a link when the sentence names the subject and the
 * polarity matches: a warning for something to avoid, praise for something to do.
 */
import { foldArabic } from '../waqfeya/clean.js';
import { topicKey } from './classify.js';

const WARNING = ['تحريم', 'حرام', 'النهي', 'نهي', 'الترهيب', 'ذم', 'كبيره', 'اثم', 'عقاب', 'وعيد'];
const PRAISE = ['فضل', 'اجر', 'الترغيب', 'استحباب', 'الحث', 'ثواب'];

export type TafsirSupport = 'ACCEPTED' | 'WEAK' | 'NONE';

export function tafsirSupport(sentence: string, topic: string, kind: 'AVOID' | 'DO'): TafsirSupport {
  const key = topicKey(topic);
  if (key.length < 4) return 'NONE';
  const folded = foldArabic(sentence);
  if (!folded.includes(key)) return 'NONE';
  const warning = WARNING.some((word) => folded.includes(word));
  const praise = PRAISE.some((word) => folded.includes(word));
  if (kind === 'AVOID' && warning && !praise) return 'ACCEPTED';
  if (kind === 'DO' && praise && !warning) return 'ACCEPTED';
  if ((kind === 'AVOID' && praise && !warning) || (kind === 'DO' && warning && !praise)) return 'NONE';
  return 'WEAK';
}

export function sentenceAround(text: string, topic: string): string {
  const key = topicKey(topic);
  const parts = text.split(/(?<=[.؟!۔])/);
  const hit = parts.find((part) => foldArabic(part).includes(key));
  return (hit ?? '').replace(/\s+/g, ' ').trim().slice(0, 400);
}
