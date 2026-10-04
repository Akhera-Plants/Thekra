import { Test } from '@nestjs/testing';
import { QuoteOrigin, QuoteType, SourceType, TagCategory } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { QuotesService } from './quotes.service.js';
import type { QuoteRowForDto } from '../../common/mappers/quote.mapper.js';

function makeRow(overrides: Partial<QuoteRowForDto> = {}): QuoteRowForDto {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    type: QuoteType.HADITH,
    origin: QuoteOrigin.LOCAL,
    textAr: 'نص عربي',
    surahNumber: null,
    surahName: null,
    surahNameAr: null,
    ayahNumber: null,
    narrator: 'Anas',
    narratorAr: 'أنس',
    grade: 'SAHIH',
    hadithReference: 'Bukhari 13',
    bookTitle: null,
    author: null,
    pageOrChapter: null,
    externalId: null,
    apiProvider: null,
    createdAt: new Date('2025-01-01T00:00:00.000Z'),
    updatedAt: new Date('2025-01-01T00:00:00.000Z'),
    source: {
      id: 'src-1',
      name: 'Bukhari',
      nameAr: 'البخاري',
      type: SourceType.HADITH_COLLECTION,
      author: null,
      authorAr: null,
      isExternalApi: false,
      apiProvider: null,
    },
    translations: [{ languageCode: 'en', text: 'English text' }],
    tags: [
      {
        tag: {
          id: 'tag-1',
          slug: 'sincerity',
          name: 'Sincerity',
          nameAr: 'الإخلاص',
          category: TagCategory.THEME,
        },
      },
    ],
    ...overrides,
  };
}

describe('QuotesService', () => {
  let service: QuotesService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        QuotesService,
        { provide: PrismaService, useValue: {} },
      ],
    }).compile();
    service = module.get(QuotesService);
  });

  describe('toQuoteDto', () => {
    it('never emits rawPayload', () => {
      const row = makeRow({
        origin: QuoteOrigin.API_CACHED,
        apiProvider: 'quran.com',
        externalId: '49:12',
      });
      const dto = service.toQuoteDto(
        { ...row, rawPayload: { secret: true } } as QuoteRowForDto & {
          rawPayload: unknown;
        },
        'en',
      );
      expect(dto).not.toHaveProperty('rawPayload');
      expect(JSON.stringify(dto)).not.toContain('secret');
    });

    it('picks the translation for lang=en and returns null when missing', () => {
      expect(service.toQuoteDto(makeRow(), 'en').translation).toEqual({
        languageCode: 'en',
        text: 'English text',
      });
      expect(
        service.toQuoteDto(makeRow({ translations: [] }), 'en').translation,
      ).toBeNull();
    });

    it('keeps textAr and omits translation for lang=ar', () => {
      const dto = service.toQuoteDto(makeRow(), 'ar');
      expect(dto.textAr).toBe('نص عربي');
      expect(dto.translation).toBeNull();
    });

    it('sets kind-specific groups to null for the wrong type', () => {
      const hadith = service.toQuoteDto(makeRow(), 'ar');
      expect(hadith.quran).toBeNull();
      expect(hadith.book).toBeNull();
      expect(hadith.hadith).not.toBeNull();

      const verse = service.toQuoteDto(
        makeRow({
          type: QuoteType.QURAN_VERSE,
          surahNumber: 49,
          surahName: 'Al-Hujurat',
          surahNameAr: 'الحجرات',
          ayahNumber: 12,
          narrator: null,
          grade: null,
          hadithReference: null,
        }),
        'ar',
      );
      expect(verse.hadith).toBeNull();
      expect(verse.book).toBeNull();
      expect(verse.quran?.surahNumber).toBe(49);
    });
  });
});
