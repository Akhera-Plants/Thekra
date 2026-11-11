import { describe, expect, it } from 'vitest';
import { publicLinkNote } from './link-note';

describe('publicLinkNote', () => {
  it('hides editorial relevance notes', () => {
    expect(publicLinkNote('adjacent speech sin, very high relevance', 'en')).toBeNull();
    expect(publicLinkNote('مرتبط بكبيرة الغيبة — درجة عالية', 'ar')).toBeNull();
  });

  it('keeps attributed chapter notes', () => {
    expect(
      publicLinkNote('من باب: حفظ اللسان — الجامع لشعب الإيمان', 'ar'),
    ).toBe('من باب: حفظ اللسان — الجامع لشعب الإيمان');
  });
});
