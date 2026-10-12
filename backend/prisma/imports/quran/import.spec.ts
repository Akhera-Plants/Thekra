import { describe, expect, it } from 'vitest';
import { chapterOf, nextVersePage } from './import.js';

describe('nextVersePage', () => {
  it('stays on the surah while the API has another page', () => {
    expect(nextVersePage({ surah: 2, nextPage: 2, surahTo: 114 })).toEqual({ surah: 2, page: 2 });
  });

  it('advances to the next surah after the last page', () => {
    expect(nextVersePage({ surah: 1, nextPage: null, surahTo: 114 })).toEqual({ surah: 2, page: 1 });
  });

  it('stops after surah 114', () => {
    expect(nextVersePage({ surah: 114, nextPage: null, surahTo: 114 })).toBeNull();
  });
});

describe('chapterOf', () => {
  it('reads the surah from the verse key when the API omits chapter_id', () => {
    expect(chapterOf({ verse_key: '2:255' })).toBe(2);
  });
});
