/**
 * Minimal smoke tests — verify that core modules can be imported and
 * the key factory produces the right shapes.
 * These run in Node.js (no React Native environment needed).
 */

import { queryKeys, PERSISTED_QUERY_KEYS } from '../lib/query-keys';
import { HadithGrade, QuoteType } from '../lib/types/enums';

describe('queryKeys', () => {
  it('sins.all is a readonly tuple', () => {
    expect(Array.isArray(queryKeys.sins.all)).toBe(true);
    expect(queryKeys.sins.all[0]).toBe('sins');
  });

  it('sins.list embeds the params object', () => {
    const key = queryKeys.sins.list({ q: 'test', limit: 10 });
    expect(key[0]).toBe('sins');
    expect(key[1]).toBe('list');
    expect(key[2]).toEqual({ q: 'test', limit: 10 });
  });

  it('sins.quotes embeds the slug and params', () => {
    const key = queryKeys.sins.quotes('ghibah', { page: 1 });
    expect(key[0]).toBe('sins');
    expect(key[1]).toBe('ghibah');
    expect(key[2]).toBe('quotes');
    expect(key[3]).toEqual({ page: 1 });
  });

  it('favorites.all is a readonly tuple', () => {
    expect(Array.isArray(queryKeys.favorites.all)).toBe(true);
    expect(queryKeys.favorites.all[0]).toBe('favorites');
  });

  it('PERSISTED_QUERY_KEYS includes sins, good-deeds, favorites, quotes', () => {
    expect(PERSISTED_QUERY_KEYS).toContain('sins');
    expect(PERSISTED_QUERY_KEYS).toContain('good-deeds');
    expect(PERSISTED_QUERY_KEYS).toContain('favorites');
    expect(PERSISTED_QUERY_KEYS).toContain('quotes');
  });
});

describe('enums', () => {
  it('HadithGrade values are strings', () => {
    expect(typeof HadithGrade.SAHIH).toBe('string');
    expect(typeof HadithGrade.HASAN).toBe('string');
    expect(typeof HadithGrade.DAIF).toBe('string');
    expect(typeof HadithGrade.UNGRADED).toBe('string');
  });

  it('QuoteType values are strings', () => {
    expect(typeof QuoteType.QURAN_VERSE).toBe('string');
    expect(typeof QuoteType.HADITH).toBe('string');
  });
});
