import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { HadithGrade, QuoteOrigin, QuoteType, SourceType, TagCategory } from '@prisma/client';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { QuoteRowForDto } from '../../common/mappers/quote.mapper.js';
import { QuotesService } from './quotes.service.js';
import type { AdminQuotesQueryDto } from './dto/admin-quotes-query.dto.js';
import type { QuotesQueryDto } from './dto/quotes-query.dto.js';
import { vi } from 'vitest';

function makeRow(overrides: Partial<QuoteRowForDto> = {}): QuoteRowForDto {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    type: QuoteType.HADITH,
    origin: QuoteOrigin.LOCAL,
    textAr: 'نص عربي',
    sourceId: 'src-1',
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
    rawPayload: null,
    createdAt: new Date('2025-01-01T00:00:00.000Z'),
    updatedAt: new Date('2025-01-01T00:00:00.000Z'),
    source: {
      id: 'src-1',
      name: 'Bukhari',
      nameAr: 'البخاري',
      type: SourceType.HADITH_COLLECTION,
      author: null,
      authorAr: null,
      language: 'ar',
      isExternalApi: false,
      apiProvider: null,
      apiBaseUrl: null,
      lastSyncedAt: null,
      createdAt: new Date('2025-01-01T00:00:00.000Z'),
      updatedAt: new Date('2025-01-01T00:00:00.000Z'),
    },
    translations: [
      {
        id: 'tr-1',
        quoteId: '00000000-0000-4000-8000-000000000001',
        languageCode: 'en',
        text: 'English text',
      },
    ],
    tags: [
      {
        id: 'qt-1',
        quoteId: '00000000-0000-4000-8000-000000000001',
        tagId: 'tag-1',
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
        rawPayload: { secret: true },
      });
      const dto = service.toQuoteDto(row, 'en');
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

// ─── P0-2 Grade-policy tests ─────────────────────────────────────────────────

/** Build a minimal Prisma mock that captures findMany's `where` argument. */
function makePrismaMock() {
  const findMany = vi.fn().mockResolvedValue([]);
  const count = vi.fn().mockResolvedValue(0);
  const findUnique = vi.fn().mockResolvedValue(null);

  const mock = {
    // $transaction with an array of promises: resolve each promise and return results
    $transaction: vi.fn((arr: Promise<unknown>[]) => Promise.all(arr)),
    quote: { findMany, count, findUnique },
  };
  return { mock, findMany, count, findUnique };
}

describe('QuotesService — grade policy (P0-2)', () => {
  let svc: QuotesService;
  let findMany: ReturnType<typeof vi.fn>;
  let findUnique: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    const { mock, findMany: fm, findUnique: fu } = makePrismaMock();
    findMany = fm;
    findUnique = fu;

    const module = await Test.createTestingModule({
      providers: [
        QuotesService,
        { provide: PrismaService, useValue: mock },
      ],
    }).compile();
    svc = module.get(QuotesService);
  });

  /** Extract the grade-OR clause from the AND array returned to findMany. */
  function gradeOrClause(where: Prisma.QuoteWhereInput) {
    const and = (where as { AND?: Prisma.QuoteWhereInput[] }).AND ?? [];
    return and.find(
      (c) =>
        'OR' in c &&
        Array.isArray((c as { OR: unknown[] }).OR) &&
        (c as { OR: { grade?: unknown }[] }).OR.some((o) => 'grade' in o),
    ) as { OR: Array<{ type?: unknown; grade?: { in: string[] } }> } | undefined;
  }

  it('search() default — grade OR restricts HADITHs to SAHIH+HASAN only', async () => {
    await svc.search({} as QuotesQueryDto);

    const where = findMany.mock.calls[0][0].where as Prisma.QuoteWhereInput;
    const clause = gradeOrClause(where);

    expect(clause).toBeDefined();
    const allowed = clause!.OR.find((o) => o.grade)?.grade?.in ?? [];
    expect(allowed).toContain(HadithGrade.SAHIH);
    expect(allowed).toContain(HadithGrade.HASAN);
    expect(allowed).not.toContain(HadithGrade.MAWDU);
    expect(allowed).not.toContain(HadithGrade.DAIF);
    expect(allowed).not.toContain(HadithGrade.UNGRADED);
  });

  it('search() with includeWeak=true — DAIF+UNGRADED added, MAWDU still excluded', async () => {
    await svc.search({ includeWeak: true } as QuotesQueryDto);

    const where = findMany.mock.calls[0][0].where as Prisma.QuoteWhereInput;
    const clause = gradeOrClause(where);

    expect(clause).toBeDefined();
    const allowed = clause!.OR.find((o) => o.grade)?.grade?.in ?? [];
    expect(allowed).toContain(HadithGrade.SAHIH);
    expect(allowed).toContain(HadithGrade.HASAN);
    expect(allowed).toContain(HadithGrade.DAIF);
    expect(allowed).toContain(HadithGrade.UNGRADED);
    expect(allowed).not.toContain(HadithGrade.MAWDU);
  });

  it('adminSearch() — no default grade filter applied (curators see all grades)', async () => {
    await svc.adminSearch({} as AdminQuotesQueryDto);

    const where = findMany.mock.calls[0][0].where as Prisma.QuoteWhereInput;
    const clause = gradeOrClause(where);

    // No grade-OR clause should be injected for the admin route
    expect(clause).toBeUndefined();
  });

  it('findById() — MAWDU hadith resolves to 404 NotFoundException', async () => {
    findUnique.mockResolvedValue(makeRow({ grade: HadithGrade.MAWDU }));

    await expect(
      svc.findById('00000000-0000-4000-8000-000000000001', {}),
    ).rejects.toThrow(NotFoundException);
  });

  it('findById() — DAIF hadith is still served (carries grade badge)', async () => {
    findUnique.mockResolvedValue(makeRow({ grade: HadithGrade.DAIF }));

    // Should resolve (not throw) for a DAIF hadith
    await expect(
      svc.findById('00000000-0000-4000-8000-000000000001', {}),
    ).resolves.toBeDefined();
  });
});
