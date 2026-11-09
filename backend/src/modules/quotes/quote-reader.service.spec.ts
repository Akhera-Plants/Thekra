import { APPROVED_WORKS } from '../../../prisma/imports/approved-works.js';
import type { PrismaService } from '../../prisma/prisma.service.js';
import { QuoteReaderService, READER_TAFSIRS } from './quote-reader.service.js';
import type { QuotesService } from './quotes.service.js';

const QUOTE = 'q0000000-0000-4000-8000-000000000001';
const LINK = 'l0000000-0000-4000-8000-000000000001';
const source = (id: string) => ({ id, name: id, nameAr: id, type: 'BOOK', author: null, authorAr: null });
const row = (id: string, kind: string, sourceId: string, languageCode = 'ar', ayahKey: string | null = '2:255') => ({
  id, kind, sourceId, languageCode, ayahKey, text: `text ${id}`, reference: null, source: source(sourceId),
});
const [MUKHTASAR, SADI, ASHUR] = READER_TAFSIRS.map((t) => t.sourceId);
const IBN_KATHIR_EN = '10000000-0000-4000-8000-000000000024';

function setup(type: string, rows: unknown[], link: { reminderAngle: string | null; reminderAngleEn: string | null } | null = null) {
  const prisma = {
    sinQuote: { findFirst: vi.fn().mockResolvedValue(null) },
    goodDeedQuote: { findFirst: vi.fn().mockResolvedValue(link) },
    imanBranchQuote: { findFirst: vi.fn().mockResolvedValue(null) },
  };
  const quotes = { publicExplanationRows: vi.fn().mockResolvedValue({ quote: { id: QUOTE, type }, rows }) };
  return { prisma, service: new QuoteReaderService(prisma as unknown as PrismaService, quotes as unknown as QuotesService) };
}

describe('READER_TAFSIRS', () => {
  it('are المختصر، السعدي، ابن عاشور, by the fixed Source ids of approved-works.ts', () => {
    const byId = new Map<string, { nameAr: string }>(APPROVED_WORKS.map((work) => [work.id, work]));
    expect(READER_TAFSIRS.map((t) => byId.get(t.sourceId)?.nameAr)).toEqual([
      'المختصر في تفسير القرآن الكريم',
      'تفسير السعدي',
      'التحرير والتنوير',
    ]);
  });
});

describe('QuoteReaderService', () => {
  it('a verse: the three tafsirs in the owner’s order, other tafsirs left out, Ibn Ashur’s passages together', async () => {
    const { service } = setup('QURAN_VERSE', [
      row('k', 'TAFSIR', IBN_KATHIR_EN, 'en'),
      row('a1', 'TAFSIR', ASHUR, 'ar', '2:250-256'),
      row('s', 'TAFSIR', SADI),
      row('a2', 'TAFSIR', ASHUR, 'ar', '2:255'),
      row('m', 'TAFSIR', MUKHTASAR),
    ]);
    const { data } = await service.read(QUOTE, 'ar');
    expect(data.tafsirs.map((t) => [t.key, t.entries.map((e) => e.id)])).toEqual([
      ['mukhtasar', ['m']],
      ['sadi', ['s']],
      ['ibn-ashur', ['a1', 'a2']],
    ]);
    expect(data.explanations).toEqual([]);
    expect(data.reminderAngle).toBeNull();
  });

  it('lang=en: the English Mukhtasar when present, Arabic-only tafsirs stay Arabic; a missing tafsir is skipped', async () => {
    const { service } = setup('QURAN_VERSE', [row('m-ar', 'TAFSIR', MUKHTASAR), row('m-en', 'TAFSIR', MUKHTASAR, 'en'), row('s', 'TAFSIR', SADI)]);
    const { data } = await service.read(QUOTE, 'en');
    expect(data.tafsirs.map((t) => [t.key, t.languageCode, t.entries[0]!.id])).toEqual([
      ['mukhtasar', 'en', 'm-en'],
      ['sadi', 'ar', 's'],
    ]);
  });

  it('a hadith keeps its sharh / fawaid / gharib in order, no tafsir', async () => {
    const { service } = setup('HADITH', [row('sh', 'SHARH', 'x', 'ar', null), row('fw', 'FAWAID', 'x', 'ar', null)]);
    const { data } = await service.read(QUOTE, 'ar');
    expect(data.explanations.map((e) => e.kind)).toEqual(['SHARH', 'FAWAID']);
    expect(data.tafsirs).toEqual([]);
  });

  it('«وجه التذكير» comes from an ACCEPTED link of this very text; English shows only written English', async () => {
    const { service, prisma } = setup('HADITH', [], { reminderAngle: 'لأن…', reminderAngleEn: null });
    expect((await service.read(QUOTE, 'ar', LINK)).data.reminderAngle).toEqual({ text: 'لأن…', languageCode: 'ar' });
    expect(prisma.sinQuote.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: LINK, quoteId: QUOTE, reviewStatus: 'ACCEPTED' } }));
    expect((await service.read(QUOTE, 'en', LINK)).data.reminderAngle).toBeNull();
  });

  it('no linkId → no link lookup', async () => {
    const { service, prisma } = setup('HADITH', []);
    await service.read(QUOTE, 'ar');
    expect(prisma.sinQuote.findFirst).not.toHaveBeenCalled();
  });
});
