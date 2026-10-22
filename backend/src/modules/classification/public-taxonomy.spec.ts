import { describe, expect, it } from 'vitest';
import { isAutoChapter, readerLinkNote } from './public-taxonomy.js';

describe('public taxonomy gate', () => {
  it('hides chapter-derived entities', () => {
    expect(isAutoChapter('AUTO_CHAPTER')).toBe(true);
    expect(isAutoChapter('CURATED')).toBe(false);
  });

  it('drops a generated note and keeps a curator note', () => {
    expect(readerLinkNote('باب تحريم الغيبة — رياض الصالحين')).toBeNull();
    expect(readerLinkNote('والغيبة ذكرك أخاك. تفسير السعدي، الحجرات 12')).toBeNull();
    expect(readerLinkNote('Al-Hujurat 49:12 — explicit primary prohibition.')).toContain('Al-Hujurat');
    expect(readerLinkNote(null)).toBeNull();
  });
});
