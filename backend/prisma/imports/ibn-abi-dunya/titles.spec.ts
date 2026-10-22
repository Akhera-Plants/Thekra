import { describe, expect, it } from 'vitest';
import { DUNYA_BOOKS } from './books.js';
import { DUNYA_TITLES_AR, DUNYA_TITLES_EN, titleEnFor } from './titles.js';

/** Settled by the owner before it gets an English title (see titles.ts). */
const UNRESOLVED = new Set(['IshrafFiManazil']);

describe('Ibn Abi al-Dunya English titles', () => {
  it('covers every catalogued work except the unresolved ones', () => {
    const missing = DUNYA_BOOKS.map((book) => book.key).filter(
      (key) => !(key in DUNYA_TITLES_EN) && !UNRESOLVED.has(key),
    );
    expect(missing).toEqual([]);
    for (const key of Object.keys(DUNYA_TITLES_EN)) expect(DUNYA_TITLES_AR).toHaveProperty(key);
  });

  it('writes the catalogue title into DunyaBook.titleEn', () => {
    const juc = DUNYA_BOOKS.find((book) => book.key === 'Juc');
    expect(juc?.titleEn).toBe("Kitab al-Ju' (Hunger)");
    expect(titleEnFor('Samt')).toBe('Al-Samt wa Adab al-Lisan (Silence and the Etiquette of the Tongue)');
  });

  it.each(Object.entries(DUNYA_TITLES_EN))('%s reads as «Transliteration (Meaning)»', (key, title) => {
    expect(title).toMatch(/^[A-Z][^()]* \([A-Z][^()]*\)$/);
    // No OpenITI key spelling left: «c» for ʿayn, or the old split-key name.
    expect(title.split(' (')[0]).not.toMatch(/[a-z]c|^C/);
    expect(title.split(' (')[0]).not.toBe(key.replace(/([a-z])([A-Z])/g, '$1 $2'));
    expect(title).not.toMatch(/[\u0600-\u06FF]/);
  });

  it('keeps the key-derived fallback for a work without an entry', () => {
    expect(titleEnFor('IshrafFiManazil')).toBe('Ishraf Fi Manazil');
  });
});
