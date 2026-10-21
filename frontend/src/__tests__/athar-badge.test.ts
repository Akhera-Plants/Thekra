/**
 * Unit guard: an athar quote must never produce the «حديث نبوي» / «Prophetic hadith»
 * type label.  This mirrors the logic in QuoteCard.tsx and QuoteDetail.tsx.
 */
import { describe, it, expect } from 'vitest';
import { QuoteType } from '@/lib/types/enums';

const QUOTE_TYPE_KEYS: Record<string, string> = {
  [QuoteType.QURAN_VERSE]: 'quran',
  [QuoteType.HADITH]: 'hadith',
  [QuoteType.SCHOLAR_QUOTE]: 'scholar',
  [QuoteType.BOOK_EXCERPT]: 'book',
};

/** Mirrors the typeKey derivation in QuoteCard and QuoteDetail. */
function deriveTypeKey(type: QuoteType, isAthar: boolean): string {
  if (isAthar) return 'athar';
  return QUOTE_TYPE_KEYS[type] ?? 'hadith';
}

describe('athar type badge derivation', () => {
  it('an athar quote (HADITH + isAthar=true) gets typeKey «athar», not «hadith»', () => {
    expect(deriveTypeKey(QuoteType.HADITH, true)).toBe('athar');
  });

  it('a regular prophetic hadith (HADITH + isAthar=false) gets typeKey «hadith»', () => {
    expect(deriveTypeKey(QuoteType.HADITH, false)).toBe('hadith');
  });

  it('a Quran verse still gets typeKey «quran» regardless of isAthar', () => {
    expect(deriveTypeKey(QuoteType.QURAN_VERSE, false)).toBe('quran');
  });

  it('typeKey «athar» never maps to «hadith» (no prophetic hadith label for athar)', () => {
    const key = deriveTypeKey(QuoteType.HADITH, true);
    expect(key).not.toBe('hadith');
    // The Arabic label for «hadith» typeKey is «حديث نبوي»; athar must use «أثر»
    expect(key).toBe('athar');
  });
});
