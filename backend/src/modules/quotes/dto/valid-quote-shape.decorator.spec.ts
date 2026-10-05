/**
 * Unit tests for P2-4: ValidQuoteShape class-level decorator and the
 * pure `checkQuoteShape` function it exposes.
 *
 * Also covers P2-1 shared helpers (buildLinkQuoteFilter, countsByTypeFromGroups)
 * and the exported LINK_ORDERING_LABEL constant.
 */
import { HadithGrade, QuoteType } from '@prisma/client';
import { validate } from 'class-validator';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { describe, expect, it, beforeEach } from 'vitest';
import { PrismaService } from '../../../prisma/prisma.service.js';
import { LINK_ORDERING_LABEL, QuotesService } from '../quotes.service.js';
import { ValidQuoteShape, checkQuoteShape } from './valid-quote-shape.decorator.js';

// ─── Pure function tests ─────────────────────────────────────────────────────

describe('checkQuoteShape (pure function)', () => {
  it('returns null for a valid HADITH with a grade', () => {
    expect(
      checkQuoteShape({ type: QuoteType.HADITH, grade: HadithGrade.SAHIH }),
    ).toBeNull();
  });

  it('returns an error string for HADITH with grade=null', () => {
    const result = checkQuoteShape({ type: QuoteType.HADITH, grade: null });
    expect(result).toMatch(/grade/i);
    expect(result).toMatch(/HADITH/);
  });

  it('returns an error string for HADITH with grade=undefined', () => {
    const result = checkQuoteShape({ type: QuoteType.HADITH });
    expect(result).toMatch(/grade/i);
    expect(result).toMatch(/HADITH/);
  });

  it('returns null for a valid QURAN_VERSE with surahNumber', () => {
    expect(
      checkQuoteShape({ type: QuoteType.QURAN_VERSE, surahNumber: 49 }),
    ).toBeNull();
  });

  it('returns an error string for QURAN_VERSE with surahNumber=null', () => {
    const result = checkQuoteShape({ type: QuoteType.QURAN_VERSE, surahNumber: null });
    expect(result).toMatch(/surahNumber/i);
    expect(result).toMatch(/QURAN_VERSE/);
  });

  it('returns an error string for QURAN_VERSE with surahNumber=undefined', () => {
    const result = checkQuoteShape({ type: QuoteType.QURAN_VERSE });
    expect(result).toMatch(/surahNumber/i);
  });

  it('returns null for SCHOLAR_QUOTE (no shape requirements)', () => {
    expect(checkQuoteShape({ type: QuoteType.SCHOLAR_QUOTE })).toBeNull();
  });

  it('returns null for BOOK_EXCERPT (no shape requirements)', () => {
    expect(checkQuoteShape({ type: QuoteType.BOOK_EXCERPT })).toBeNull();
  });

  it('returns null when type is undefined (shape cannot be evaluated)', () => {
    expect(checkQuoteShape({ grade: HadithGrade.SAHIH })).toBeNull();
  });
});

// ─── Decorator tests via class-validator validate() ──────────────────────────

@ValidQuoteShape()
class TestQuoteDto {
  type?: QuoteType;
  grade?: HadithGrade | null;
  surahNumber?: number | null;
}

describe('@ValidQuoteShape() decorator', () => {
  async function validateShape(
    partial: Partial<TestQuoteDto>,
  ): Promise<string[]> {
    const obj = Object.assign(new TestQuoteDto(), partial);
    const errors = await validate(obj);
    return errors.flatMap((e) => Object.values(e.constraints ?? {}));
  }

  it('passes for HADITH with a valid grade', async () => {
    const msgs = await validateShape({ type: QuoteType.HADITH, grade: HadithGrade.HASAN });
    expect(msgs).toHaveLength(0);
  });

  it('fails for HADITH with null grade — message mentions grade and HADITH', async () => {
    const msgs = await validateShape({ type: QuoteType.HADITH, grade: null });
    expect(msgs.length).toBeGreaterThan(0);
    expect(msgs.join(' ')).toMatch(/grade/i);
  });

  it('fails for HADITH with no grade at all', async () => {
    const msgs = await validateShape({ type: QuoteType.HADITH });
    expect(msgs.length).toBeGreaterThan(0);
    expect(msgs.join(' ')).toMatch(/HADITH/);
  });

  it('passes for QURAN_VERSE with a surahNumber', async () => {
    const msgs = await validateShape({ type: QuoteType.QURAN_VERSE, surahNumber: 2 });
    expect(msgs).toHaveLength(0);
  });

  it('fails for QURAN_VERSE with null surahNumber — message mentions surahNumber', async () => {
    const msgs = await validateShape({ type: QuoteType.QURAN_VERSE, surahNumber: null });
    expect(msgs.length).toBeGreaterThan(0);
    expect(msgs.join(' ')).toMatch(/surahNumber/i);
  });

  it('passes for SCHOLAR_QUOTE without extra fields', async () => {
    const msgs = await validateShape({ type: QuoteType.SCHOLAR_QUOTE });
    expect(msgs).toHaveLength(0);
  });

  it('passes for BOOK_EXCERPT without extra fields', async () => {
    const msgs = await validateShape({ type: QuoteType.BOOK_EXCERPT });
    expect(msgs).toHaveLength(0);
  });
});

// ─── Shared filter helpers (P2-1) ─────────────────────────────────────────────

function makeServiceModule() {
  return Test.createTestingModule({
    providers: [
      QuotesService,
      { provide: PrismaService, useValue: {} },
      { provide: ConfigService, useValue: { get: () => 70 } },
    ],
  }).compile();
}

describe('QuotesService.buildLinkQuoteFilter (P2-1)', () => {
  let svc: QuotesService;

  beforeEach(async () => {
    const module = await makeServiceModule();
    svc = module.get(QuotesService);
  });

  it('default — resolves to SAHIH+HASAN grades for hadiths', () => {
    const { allowedGrades, quoteFilter } = svc.buildLinkQuoteFilter({});
    expect(allowedGrades).toContain('SAHIH');
    expect(allowedGrades).toContain('HASAN');
    expect(allowedGrades).not.toContain('MAWDU');
    // quoteFilter.OR should allow non-HADITH types to pass through
    const or = (quoteFilter as { OR?: unknown[] }).OR;
    expect(Array.isArray(or)).toBe(true);
  });

  it('includes DAIF when includeWeak=true', () => {
    const { allowedGrades } = svc.buildLinkQuoteFilter({ includeWeak: true });
    expect(allowedGrades).toContain('DAIF');
    expect(allowedGrades).not.toContain('MAWDU');
  });

  it('adds a type filter when type array is provided', () => {
    const { quoteFilter } = svc.buildLinkQuoteFilter({ type: [QuoteType.HADITH] });
    expect((quoteFilter as { type?: { in: string[] } }).type?.in).toContain('HADITH');
  });

  it('omits type key when type array is empty', () => {
    const { quoteFilter } = svc.buildLinkQuoteFilter({ type: [] });
    expect((quoteFilter as Record<string, unknown>).type).toBeUndefined();
  });
});

describe('QuotesService.countsByTypeFromGroups (P2-1)', () => {
  let svc: QuotesService;

  beforeEach(async () => {
    const module = await makeServiceModule();
    svc = module.get(QuotesService);
  });

  it('returns zero for all types when groups is empty', () => {
    expect(svc.countsByTypeFromGroups([])).toEqual({
      QURAN_VERSE: 0,
      HADITH: 0,
      SCHOLAR_QUOTE: 0,
      BOOK_EXCERPT: 0,
    });
  });

  it('maps group counts correctly', () => {
    const groups = [
      { type: 'QURAN_VERSE', _count: { _all: 7 } },
      { type: 'HADITH', _count: { _all: 3 } },
    ];
    const result = svc.countsByTypeFromGroups(groups);
    expect(result.QURAN_VERSE).toBe(7);
    expect(result.HADITH).toBe(3);
    expect(result.SCHOLAR_QUOTE).toBe(0);
  });
});

describe('LINK_ORDERING_LABEL constant (P2-1)', () => {
  it('is exported and matches the legacy ORDERING string', () => {
    expect(LINK_ORDERING_LABEL).toBe('relevanceScore:desc,grade:asc,createdAt:desc');
  });
});
