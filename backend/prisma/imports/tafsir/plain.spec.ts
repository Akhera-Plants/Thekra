import { describe, expect, it } from 'vitest';
import { plainTafsir } from './plain.js';

describe('plainTafsir', () => {
  it('drops Quran.com spans and keeps the Arabic', () => {
    const html = '<span class="arabic qpc-hafs brown">{ بِسْمِ اللَّهِ }</span> أي: أبتدئ بكل اسم لله تعالى';
    expect(plainTafsir(html)).toBe('{ بِسْمِ اللَّهِ } أي: أبتدئ بكل اسم لله تعالى');
  });
});
