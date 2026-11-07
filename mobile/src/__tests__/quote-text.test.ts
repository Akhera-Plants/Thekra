import { stripOuterQuotes, verseSourceLine } from '@/lib/quote-text';
import { ayahAudioUrl } from '@/lib/audio/recitation';

describe('stripOuterQuotes (A-04)', () => {
  it('removes guillemets that wrap the whole text', () => {
    expect(stripOuterQuotes('«إنما الأعمال بالنيات»')).toBe('إنما الأعمال بالنيات');
  });
  it('removes straight and curly double quotes', () => {
    expect(stripOuterQuotes('" من صمت نجا "')).toBe('من صمت نجا');
    expect(stripOuterQuotes('“الدين النصيحة”')).toBe('الدين النصيحة');
  });
  it('keeps marks that do not wrap the whole text', () => {
    expect(stripOuterQuotes('قال: «الدين النصيحة»')).toBe('قال: «الدين النصيحة»');
    expect(stripOuterQuotes('«أ» ثم «ب»')).toBe('«أ» ثم «ب»');
    expect(stripOuterQuotes('"أ" و"ب"')).toBe('"أ" و"ب"');
  });
  it('keeps an inner quotation when the outer pair is removed', () => {
    expect(stripOuterQuotes('«قال: «اتق الله»»')).toBe('قال: «اتق الله»');
  });
  it('leaves plain text alone', () => {
    expect(stripOuterQuotes('  نص بلا علامات ')).toBe('نص بلا علامات');
  });
});

describe('verseSourceLine (A-16)', () => {
  it('names the surah and the ayah', () => {
    expect(verseSourceLine({ surahNameAr: 'هود', surahName: 'Hud', surahNumber: 11, ayahNumber: 114 }, true)).toBe('هود: 114');
    expect(verseSourceLine({ surahNameAr: 'هود', surahName: 'Hud', surahNumber: 11, ayahNumber: 114 }, false)).toBe('Hud 11:114');
  });
  it('is null without a reference', () => {
    expect(verseSourceLine(null, true)).toBeNull();
  });
});

describe('ayahAudioUrl (F-03)', () => {
  it('pads surah and ayah to three digits', () => {
    expect(ayahAudioUrl(11, 114, 'https://x/')).toBe('https://x/011114.mp3');
    expect(ayahAudioUrl(1, 1, 'https://x/')).toBe('https://x/001001.mp3');
  });
  it('refuses impossible references', () => {
    expect(ayahAudioUrl(0, 1)).toBeNull();
    expect(ayahAudioUrl(115, 1)).toBeNull();
    expect(ayahAudioUrl(2, 0)).toBeNull();
  });
});
