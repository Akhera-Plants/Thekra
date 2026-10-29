/**
 * «لماذا هذا الحديث؟» on a card: only public attribution notes reach the reader, as on the website
 * (frontend/src/lib/format/link-note.spec.ts), joined with « · » in the app.
 */

import { publicLinkNote } from '../lib/study/link-note';

describe('publicLinkNote', () => {
  it('hides editorial relevance notes and empty ones', () => {
    expect(publicLinkNote('adjacent speech sin, very high relevance', 'en')).toBeNull();
    expect(publicLinkNote('مرتبط بكبيرة الغيبة — درجة عالية', 'ar')).toBeNull();
    expect(publicLinkNote(null, 'ar')).toBeNull();
    expect(publicLinkNote('   ', 'ar')).toBeNull();
  });

  it('keeps attributed notes, with the app separator instead of a dash', () => {
    expect(publicLinkNote('من باب: حفظ اللسان — الجامع لشعب الإيمان', 'ar')).toBe('من باب: حفظ اللسان · الجامع لشعب الإيمان');
    expect(publicLinkNote('ذكره  الذهبي في الكبائر', 'ar')).toBe('ذكره الذهبي في الكبائر');
    expect(publicLinkNote('من كتاب رياض الصالحين', 'ar')).toBe('من كتاب رياض الصالحين');
  });

  it('renders the attribution in English and drops the Arabic chapter title', () => {
    expect(publicLinkNote('أورده النووي في باب: الصبر — رياض الصالحين', 'en')).toBe('Cited by al-Nawawi · Riyad al-Salihin');
    expect(publicLinkNote('ذكره الذهبي في الكبائر، ص 12', 'en')).toBe('Mentioned by al-Dhahabi in Al-Kabair, p. 12');
    expect(publicLinkNote('من باب: حفظ اللسان — الجامع لشعب الإيمان', 'en')).toBe("From Shu'ab al-Iman");
    expect(publicLinkNote('من كتاب الأدب المفرد', 'en')).toBe('From Al-Adab al-Mufrad');
  });
});
