import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { RECITATION_ORIGIN, recitationUrl } from './recitation';

describe('recitationUrl', () => {
  it('pads surah and ayah to three digits', () => {
    expect(recitationUrl(2, 255)).toBe('https://everyayah.com/data/Alafasy_128kbps/002255.mp3');
    expect(recitationUrl(114, 6)).toBe('https://everyayah.com/data/Alafasy_128kbps/114006.mp3');
  });
  it('refuses numbers outside the mushaf', () => {
    expect(recitationUrl(0, 1)).toBeNull();
    expect(recitationUrl(115, 1)).toBeNull();
    expect(recitationUrl(1, 0)).toBeNull();
    expect(recitationUrl(1.5, 2)).toBeNull();
  });
  it('exposes the origin the CSP must allow', () => {
    expect(RECITATION_ORIGIN).toBe('https://everyayah.com');
    const config = readFileSync(path.resolve(__dirname, '../../../next.config.ts'), 'utf8');
    expect(config).toMatch(new RegExp(`"media-src 'self' ${RECITATION_ORIGIN.replace(/[.]/g, '\\.')}"`));
  });
});
