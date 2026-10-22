import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ashurGaps, parseAshur } from './ashur.js';

const FIXTURE = `
### | [سورة الفاتحة (1) : الآيات 1 الى 7]
# الحمد لله
### | [سورة البقرة (2) : آية
# 1]</span>
# الم
### | [سورة البقرة (2) : آية1]
# ذلك الكتاب
### | [سورة النحل (16) : الآيات 28 إلى ms452629]
# ليس آية
### | [سورة العصر (103) : الآيات ms9607 1 إلى 3]
# والعصر
`;

describe('parseAshur', () => {
  const parsed = parseAshur(FIXTURE);

  it('reads a range, a wrapped number, and a number glued to the word', () => {
    expect(parsed.passages.map((passage) => passage.ayahKey)).toEqual(['1:1-7', '2:1', '2:1', '103:1-3']);
  });

  it('drops a milestone that pretended to be an ayah number', () => {
    expect(parsed.unparsed.some((heading) => heading.includes('النحل'))).toBe(true);
  });

  it('strips the milestone before the real range', () => {
    expect(parsed.passages.find((passage) => passage.surah === 103)?.text).toContain('والعصر');
  });
});

describe('parseAshur on the pinned file', () => {
  const path = new URL('../../../.corpus/1393MuhammadTahirIbnCashurTunisi.TahrirWaTanwir.Shamela0009776-ara1', import.meta.url);

  it('covers al-Fatiha and reads the wrapped Baqara heading', () => {
    if (!existsSync(path)) return;
    const parsed = parseAshur(readFileSync(path, 'utf8'));
    expect(parsed.passages.length).toBeGreaterThan(3500);
    expect(parsed.unparsed.length).toBeLessThan(40);
    expect(ashurGaps(parsed.passages, ['1:1', '1:7', '2:1']).length).toBe(0);
    expect(parsed.passages.find((passage) => passage.ayahKey === '2:1')?.text).toContain('الم');
  });
});

describe('ashurGaps', () => {
  it('names the ayat no passage covers', () => {
    const parsed = parseAshur(FIXTURE);
    expect(ashurGaps(parsed.passages, ['1:1', '1:2', '2:2', '103:3'])).toEqual(['2:2']);
  });
});
