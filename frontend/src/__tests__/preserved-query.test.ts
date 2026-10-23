import { describe, expect, it } from 'vitest';
import { preservedQuery } from '@/lib/search/preserved-query';

describe('preservedQuery (language switch, audit B09)', () => {
  it('keeps the theme chip and the catalogue search', () => {
    expect(preservedQuery('?theme=lisan-ghibah')).toBe('?theme=lisan-ghibah');
    expect(preservedQuery('?q=%D8%BA%D8%B6')).toBe('?q=%D8%BA%D8%B6');
  });

  it('drops every other parameter', () => {
    expect(preservedQuery('?theme=ghibah-tahrim&next=https://evil.example&utm_source=x')).toBe('?theme=ghibah-tahrim');
    expect(preservedQuery('')).toBe('');
  });

  it('drops an invalid theme or an overlong search', () => {
    expect(preservedQuery('?theme=../../admin')).toBe('');
    expect(preservedQuery(`?q=${'a'.repeat(101)}`)).toBe('');
  });
});
