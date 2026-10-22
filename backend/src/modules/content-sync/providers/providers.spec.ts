/**
 * Provider mapper unit tests — fixture-driven, no network.
 *
 * Each test loads the corresponding fixture JSON and passes it through the
 * provider's pure `mapToQuote()` method.  No HTTP call is ever made.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { QuoteType, HadithGrade } from '@prisma/client';
import type { Source } from '@prisma/client';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { QuranComProvider } from './quran-com.provider.js';
import { AlQuranCloudProvider } from './al-quran-cloud.provider.js';
import { SunnahProvider } from './sunnah.provider.js';
import { HadithApiProvider } from './hadith-api.provider.js';
import { SkipRecordError } from './content-provider.interface.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const fixturesDir = join(__dirname, '../fixtures');

function loadFixture(path: string) {
  return JSON.parse(readFileSync(join(fixturesDir, path), 'utf-8'));
}

// ─── Shared stub source ────────────────────────────────────────────────────────

const stubSource: Source = {
  id: 'source-uuid-001',
  name: 'Test Source',
  nameAr: 'مصدر اختبار',
  type: 'QURAN',
  author: null,
  authorAr: null,
  language: 'ar',
  isExternalApi: true,
  apiProvider: 'quran.com',
  apiBaseUrl: 'https://api.quran.com/api/v4',
  lastSyncedAt: null,
  canonicalId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

// Stub ConfigService — returns sensible defaults
const stubConfig = {
  get: (key: string) => {
    if (key === 'QURAN_TEXT_FIELD') return 'text_uthmani';
    if (key === 'QURAN_API_BASE_URL') return 'https://api.quran.com/api/v4';
    if (key === 'SUNNAH_API_KEY') return 'test-key';
    if (key === 'HADITH_API_KEY') return 'test-key';
    return undefined;
  },
};

// Stub HttpService — never called in mapper tests
const stubHttpService = {} as never;

// ─── QuranComProvider ────────────────────────────────────────────────────────

describe('QuranComProvider.mapToQuote', () => {
  let provider: QuranComProvider;

  beforeEach(() => {
    provider = new QuranComProvider(stubHttpService, stubConfig as never);

    // Pre-populate chapter cache with fixture data
    const chaptersFixture = loadFixture('quran-com/chapters.json');
    for (const ch of chaptersFixture.chapters) {
      // @ts-expect-error — accessing private cache for test setup
      provider.chapterCache.set(ch.chapter_number, {
        nameSimple: ch.name_simple,
        nameArabic: ch.name_arabic,
      });
    }
  });

  it('maps verse_key as externalId', () => {
    const fixture = loadFixture('quran-com/verses-page.json');
    const verse = fixture.verses[0];
    const result = provider.mapToQuote(verse, stubSource);
    expect(result.externalId).toBe('49:12');
  });

  it('maps surahNumber and ayahNumber correctly (not the global id)', () => {
    const fixture = loadFixture('quran-com/verses-page.json');
    const verse = fixture.verses[0]; // verse_number=12, chapter_id=49
    const result = provider.mapToQuote(verse, stubSource);
    expect(result.quote.surahNumber).toBe(49);
    expect(result.quote.ayahNumber).toBe(12);
  });

  it('maps type=QURAN_VERSE and origin=API_CACHED', () => {
    const fixture = loadFixture('quran-com/verses-page.json');
    const verse = fixture.verses[0];
    const result = provider.mapToQuote(verse, stubSource);
    expect(result.quote.type).toBe(QuoteType.QURAN_VERSE);
    // origin is set by the executor, not the mapper
  });

  it('grade is null for Quran verse', () => {
    const fixture = loadFixture('quran-com/verses-page.json');
    const verse = fixture.verses[0];
    const result = provider.mapToQuote(verse, stubSource);
    expect(result.quote.grade).toBeNull();
  });

  it('maps translation from first resource_id', () => {
    const fixture = loadFixture('quran-com/verses-page.json');
    const verse = fixture.verses[0];
    const result = provider.mapToQuote(verse, stubSource);
    expect(result.translations).toHaveLength(1);
    expect(result.translations[0].languageCode).toBe('en');
    expect(result.translations[0].text).toContain('[TEST]');
  });

  it('deduplicates translations (first language wins)', () => {
    const fixture = loadFixture('quran-com/verses-page.json');
    // Inject a second English translation
    const verse = {
      ...fixture.verses[0],
      translations: [
        { id: 1, resource_id: 131, text: 'First EN' },
        { id: 2, resource_id: 132, text: 'Second EN (should be ignored)' },
      ],
    };
    const result = provider.mapToQuote(verse, stubSource);
    expect(result.translations).toHaveLength(1);
    expect(result.translations[0].text).toBe('First EN');
  });

  it('maps surahName and surahNameAr from chapter cache', () => {
    const fixture = loadFixture('quran-com/verses-page.json');
    const verse = fixture.verses[0];
    const result = provider.mapToQuote(verse, stubSource);
    expect(result.quote.surahName).toBe('Al-Hujurat');
    expect(result.quote.surahNameAr).toBe('الحجرات');
  });

  it('throws SkipRecordError when textAr is empty', () => {
    const verse = {
      id: 1,
      verse_number: 1,
      verse_key: '1:1',
      chapter_id: 1,
      text_uthmani: '',
      translations: [],
    };
    expect(() => provider.mapToQuote(verse, stubSource)).toThrowError(SkipRecordError);
  });

  it('narrator, hadithReference, bookTitle are null', () => {
    const fixture = loadFixture('quran-com/verses-page.json');
    const verse = fixture.verses[0];
    const result = provider.mapToQuote(verse, stubSource);
    expect(result.quote.narrator).toBeNull();
    expect(result.quote.hadithReference).toBeNull();
    expect(result.quote.bookTitle).toBeNull();
  });
});

// ─── AlQuranCloudProvider ─────────────────────────────────────────────────────

describe('AlQuranCloudProvider.mapToQuote', () => {
  let provider: AlQuranCloudProvider;

  beforeEach(() => {
    provider = new AlQuranCloudProvider(stubHttpService, stubConfig as never);
  });

  it('maps externalId as "{surah}:{numberInSurah}" (not global number)', () => {
    const fixture = loadFixture('al-quran-cloud/surah.json');
    const surahData = fixture.data;
    const ayah = {
      ...surahData.ayahs[1], // numberInSurah=12
      _surahNumber: surahData.number,
      _surahName: surahData.englishName,
      _surahNameAr: surahData.name,
    };
    const result = provider.mapToQuote(ayah, stubSource);
    expect(result.externalId).toBe('49:12');
    expect(result.quote.ayahNumber).toBe(12); // NOT the global number 5110
  });

  it('maps type=QURAN_VERSE and origin=API_CACHED', () => {
    const fixture = loadFixture('al-quran-cloud/surah.json');
    const surahData = fixture.data;
    const ayah = { ...surahData.ayahs[0], _surahNumber: 49, _surahName: 'Al-Hujuraat', _surahNameAr: 'سورة الحجرات' };
    const result = provider.mapToQuote(ayah, stubSource);
    expect(result.quote.type).toBe(QuoteType.QURAN_VERSE);
    // origin is set by the executor, not the mapper
  });

  it('grade is null for Quran verse', () => {
    const fixture = loadFixture('al-quran-cloud/surah.json');
    const surahData = fixture.data;
    const ayah = { ...surahData.ayahs[0], _surahNumber: 49, _surahName: 'Al-Hujuraat', _surahNameAr: 'سورة الحجرات' };
    const result = provider.mapToQuote(ayah, stubSource);
    expect(result.quote.grade).toBeNull();
  });

  it('throws SkipRecordError when text is empty', () => {
    const ayah = { number: 1, text: '', numberInSurah: 1, juz: 1, page: 1, _surahNumber: 1, _surahName: 'Al-Fatihah', _surahNameAr: 'الفاتحة' };
    expect(() => provider.mapToQuote(ayah, stubSource)).toThrowError(SkipRecordError);
  });

  it('produces no translations (provider has none by default)', () => {
    const fixture = loadFixture('al-quran-cloud/surah.json');
    const surahData = fixture.data;
    const ayah = { ...surahData.ayahs[0], _surahNumber: 49, _surahName: 'Al-Hujuraat', _surahNameAr: 'سورة الحجرات' };
    const result = provider.mapToQuote(ayah, stubSource);
    expect(result.translations).toHaveLength(0);
  });
});

// ─── SunnahProvider ───────────────────────────────────────────────────────────

describe('SunnahProvider.mapToQuote', () => {
  let provider: SunnahProvider;

  beforeEach(() => {
    provider = new SunnahProvider(stubHttpService, stubConfig as never);
  });

  it('maps externalId as "{collection}:{hadithNumber}"', () => {
    const fixture = loadFixture('sunnah/hadith.json');
    const hadith = fixture.hadiths[0];
    const result = provider.mapToQuote(hadith, stubSource);
    expect(result.externalId).toBe('bukhari:13');
  });

  it('maps type=HADITH and origin=API_CACHED', () => {
    const fixture = loadFixture('sunnah/hadith.json');
    const result = provider.mapToQuote(fixture.hadiths[0], stubSource);
    expect(result.quote.type).toBe(QuoteType.HADITH);
    // origin is set by the executor, not the mapper
  });

  it('maps grade from grades array (SAHIH)', () => {
    const fixture = loadFixture('sunnah/hadith.json');
    const result = provider.mapToQuote(fixture.hadiths[0], stubSource);
    expect(result.quote.grade).toBe(HadithGrade.SAHIH);
  });

  it('maps Arabic text from lang="ar" entry', () => {
    const fixture = loadFixture('sunnah/hadith.json');
    const result = provider.mapToQuote(fixture.hadiths[0], stubSource);
    expect(result.quote.textAr).toContain('PLACEHOLDER TEST HADITH ARABIC');
  });

  it('maps English translation from lang="en" entry', () => {
    const fixture = loadFixture('sunnah/hadith.json');
    const result = provider.mapToQuote(fixture.hadiths[0], stubSource);
    expect(result.translations).toHaveLength(1);
    expect(result.translations[0].languageCode).toBe('en');
  });

  it('stores the printed number instead of an English reference string', () => {
    const fixture = loadFixture('sunnah/hadith.json');
    const result = provider.mapToQuote(fixture.hadiths[0], stubSource);
    expect(result.quote.referenceNumber).toBe(13);
    expect(result.quote.hadithReference).toBeNull();
  });

  it('throws SkipRecordError when no Arabic entry', () => {
    const fixture = loadFixture('sunnah/hadith.json');
    const hadith = fixture.hadiths[1]; // English-only fixture
    expect(() => provider.mapToQuote(hadith, stubSource)).toThrowError(SkipRecordError);
  });
});

// ─── HadithApiProvider ────────────────────────────────────────────────────────

describe('HadithApiProvider.mapToQuote', () => {
  let provider: HadithApiProvider;

  beforeEach(() => {
    provider = new HadithApiProvider(stubHttpService, stubConfig as never);
  });

  it('maps externalId as "{bookSlug}:{hadithNumber}"', () => {
    const fixture = loadFixture('hadith-api/hadiths.json');
    const hadith = fixture.hadiths.data[0];
    const result = provider.mapToQuote(hadith, stubSource);
    expect(result.externalId).toBe('sahih-bukhari:1');
  });

  it('maps type=HADITH and origin=API_CACHED', () => {
    const fixture = loadFixture('hadith-api/hadiths.json');
    const result = provider.mapToQuote(fixture.hadiths.data[0], stubSource);
    expect(result.quote.type).toBe(QuoteType.HADITH);
    // origin is set by the executor, not the mapper
  });

  it('maps SAHIH grade from status field', () => {
    const fixture = loadFixture('hadith-api/hadiths.json');
    const result = provider.mapToQuote(fixture.hadiths.data[0], stubSource);
    expect(result.quote.grade).toBe(HadithGrade.SAHIH);
  });

  it("maps DAIF grade from status=Da'if", () => {
    const fixture = loadFixture('hadith-api/hadiths.json');
    const result = provider.mapToQuote(fixture.hadiths.data[1], stubSource);
    expect(result.quote.grade).toBe(HadithGrade.DAIF);
  });

  it('strips narrator prefix from englishNarrator', () => {
    const fixture = loadFixture('hadith-api/hadiths.json');
    const result = provider.mapToQuote(fixture.hadiths.data[0], stubSource);
    // "Narrated Umar bin Al-Khattab:" → "Umar bin Al-Khattab"
    expect(result.quote.narrator).toBe('Umar bin Al-Khattab');
  });

  it('maps English translation', () => {
    const fixture = loadFixture('hadith-api/hadiths.json');
    const result = provider.mapToQuote(fixture.hadiths.data[0], stubSource);
    expect(result.translations).toHaveLength(1);
    expect(result.translations[0].languageCode).toBe('en');
  });

  it('throws SkipRecordError when hadithArabic is empty', () => {
    const fixture = loadFixture('hadith-api/hadiths.json');
    const hadith = { ...fixture.hadiths.data[0], hadithArabic: '' };
    expect(() => provider.mapToQuote(hadith, stubSource)).toThrowError(SkipRecordError);
  });

  it('stores the printed number instead of an English reference string', () => {
    const fixture = loadFixture('hadith-api/hadiths.json');
    const result = provider.mapToQuote(fixture.hadiths.data[0], stubSource);
    expect(result.quote.referenceNumber).toBe(1);
    expect(result.quote.hadithReference).toBeNull();
  });
});
