import { describe, expect, it } from 'vitest';
import { skipKabairFaslAyah } from './links.js';

describe('skipKabairFaslAyah', () => {
  it('skips ayah items under al-Kabair فصل sub-sections', () => {
    expect(skipKabairFaslAyah({ book: 'kabair', level: 'FASL' }, 'AYAH')).toBe(true);
  });

  it('keeps hadith under those فصل sub-sections', () => {
    expect(skipKabairFaslAyah({ book: 'kabair', level: 'FASL' }, 'HADITH')).toBe(false);
  });

  it('keeps ayah on the KABIRA opening itself', () => {
    expect(skipKabairFaslAyah({ book: 'kabair', level: 'KABIRA' }, 'AYAH')).toBe(false);
  });

  it('does not affect other books', () => {
    expect(skipKabairFaslAyah({ book: 'zuhd', level: 'FASL' }, 'AYAH')).toBe(false);
  });
});
