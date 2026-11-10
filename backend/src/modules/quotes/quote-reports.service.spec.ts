import { HttpException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { PrismaService } from '../../prisma/prisma.service.js';
import { cleanReportNote, QuoteReportsService, REPORT_LIMITS } from './quote-reports.service.js';

const NOW = new Date('2026-11-09T12:00:00.000Z');
const QUOTE = 'q0000000-0000-4000-8000-000000000001';

const codeOf = (error: unknown) => ((error as HttpException).getResponse() as { code: string }).code;
const statusOf = (error: unknown) => (error as HttpException).getStatus();

function setup(secret = 'test-access-secret') {
  const prisma = {
    quote: { findUnique: vi.fn().mockResolvedValue({ id: QUOTE, type: 'HADITH' }) },
    quoteReport: {
      count: vi.fn().mockResolvedValue(0),
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([{ reporterKey: 'a' }]),
      create: vi.fn().mockResolvedValue({}),
    },
    quoteFlag: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockResolvedValue({}),
    },
    $queryRaw: vi.fn().mockResolvedValue([]),
    $transaction: vi.fn(),
  };
  prisma.$transaction.mockImplementation((fn: (tx: typeof prisma) => Promise<unknown>) => fn(prisma));
  const config = { get: vi.fn().mockReturnValue(secret) } as unknown as ConfigService;
  const service = new QuoteReportsService(prisma as unknown as PrismaService, config as never);
  return { prisma, service };
}

/** count() is called for: today (global), the reporter's last hour, the reporter's last day — in that order. */
function counts(prisma: ReturnType<typeof setup>['prisma'], today: number, hour: number, day: number) {
  prisma.quoteReport.count.mockResolvedValueOnce(today).mockResolvedValueOnce(hour).mockResolvedValueOnce(day);
}

describe('cleanReportNote', () => {
  it('trims, drops control and direction-override characters, keeps new lines; empty → null', () => {
    expect(cleanReportNote('  لفظة‮ غير\u0007 واضحة \n\n\n\nسطر  ')).toBe('لفظة غير واضحة \n\nسطر');
    expect(cleanReportNote(' ‏⁦ ')).toBe('‏');
    expect(cleanReportNote('   ')).toBeNull();
    expect(cleanReportNote(undefined)).toBeNull();
  });
});

describe('QuoteReportsService', () => {
  describe('reporterKey', () => {
    it('is a keyed hash: no raw address or id; an account is one key, an address one key per day', () => {
      const { service } = setup();
      const user = service.reporterKey({ userId: 'user-1', ip: '1.2.3.4' }, NOW);
      expect(user).toMatch(/^u:[0-9a-f]{32}$/);
      expect(service.reporterKey({ userId: 'user-1', ip: '9.9.9.9' }, NOW)).toBe(user);
      const anon = service.reporterKey({ ip: '1.2.3.4' }, NOW);
      expect(anon).toMatch(/^a:[0-9a-f]{32}$/);
      expect(anon).not.toContain('1.2.3.4');
      expect(service.reporterKey({ ip: '1.2.3.4' }, new Date('2026-11-10T00:00:01.000Z'))).not.toBe(anon);
      expect(setup('another-secret').service.reporterKey({ ip: '1.2.3.4' }, NOW)).not.toBe(anon);
    });
  });

  it('404 for a missing text (nothing stored)', async () => {
    const { service, prisma } = setup();
    prisma.quote.findUnique.mockResolvedValueOnce(null);
    expect(statusOf(await service.report(QUOTE, 'TEXT', undefined, { ip: '1.1.1.1' }, NOW).catch((e: unknown) => e))).toBe(404);
    expect(prisma.quoteReport.create).not.toHaveBeenCalled();
  });

  it('accepts a report on a verse (round 6: «أبلغ عن خطأ» under «وجه التذكير»), but never turns it HIGH', async () => {
    const { service, prisma } = setup();
    prisma.quote.findUnique.mockResolvedValue({ id: QUOTE, type: 'QURAN_VERSE' });
    prisma.quoteReport.findMany.mockResolvedValue([{ reporterKey: 'a' }, { reporterKey: 'b' }, { reporterKey: 'c' }]);
    await expect(service.report(QUOTE, 'CLASSIFICATION', 'لا صلة', { ip: '1.2.3.4' }, NOW)).resolves.toEqual({ data: { accepted: true } });
    expect(prisma.quoteReport.create).toHaveBeenCalledTimes(1);
    const flag = prisma.quoteFlag.create.mock.calls[0]![0].data;
    expect(flag).toMatchObject({ severity: 'MEDIUM', type: 'USER_REPORT', details: { reporters: 3 } });
  });

  it('stores the report and opens a MEDIUM flag with a bounded summary (no address)', async () => {
    const { service, prisma } = setup();
    await expect(service.report(QUOTE, 'TEXT', ' لفظة ', { ip: '1.2.3.4' }, NOW)).resolves.toEqual({ data: { accepted: true } });
    const stored = prisma.quoteReport.create.mock.calls[0]![0].data;
    expect(stored).toMatchObject({ quoteId: QUOTE, reason: 'TEXT', note: 'لفظة' });
    expect(JSON.stringify(stored)).not.toContain('1.2.3.4');
    const flag = prisma.quoteFlag.create.mock.calls[0]![0].data;
    expect(flag).toMatchObject({ severity: 'MEDIUM', type: 'USER_REPORT', details: { total: 1, reporters: 1 } });
    expect(JSON.stringify(flag)).not.toContain('1.2.3.4');
  });

  it('a duplicate (same reporter, text and reason within 24 h) is accepted and not stored again', async () => {
    const { service, prisma } = setup();
    prisma.quoteReport.findFirst.mockResolvedValue({ id: 'r1' });
    await expect(service.report(QUOTE, 'TEXT', undefined, { ip: '1.2.3.4' }, NOW)).resolves.toEqual({ data: { accepted: true } });
    expect(prisma.$transaction).not.toHaveBeenCalled();
    const where = prisma.quoteReport.findFirst.mock.calls[0]![0].where;
    expect(where).toMatchObject({ quoteId: QUOTE, reason: 'TEXT' });
    expect(NOW.getTime() - where.createdAt.gt.getTime()).toBe(REPORT_LIMITS.dedupeHours * 3_600_000);
  });

  it(`429 REPORT_RATE_LIMITED at ${REPORT_LIMITS.perReporterHour} an hour or ${REPORT_LIMITS.perReporterDay} a day per reporter`, async () => {
    const { service, prisma } = setup();
    counts(prisma, 0, REPORT_LIMITS.perReporterHour, 0);
    let error = await service.report(QUOTE, 'TEXT', undefined, { userId: 'u1' }, NOW).catch((e: unknown) => e);
    expect([statusOf(error), codeOf(error)]).toEqual([429, 'REPORT_RATE_LIMITED']);
    counts(prisma, 0, 0, REPORT_LIMITS.perReporterDay);
    error = await service.report(QUOTE, 'TEXT', undefined, { userId: 'u1' }, NOW).catch((e: unknown) => e);
    expect(codeOf(error)).toBe('REPORT_RATE_LIMITED');
    expect(prisma.quoteReport.create).not.toHaveBeenCalled();
  });

  it(`429 REPORTS_PAUSED past ${REPORT_LIMITS.globalDaily} reports in the UTC day, with the seconds until midnight`, async () => {
    const { service, prisma } = setup();
    counts(prisma, REPORT_LIMITS.globalDaily, 0, 0);
    const error = await service.report(QUOTE, 'TEXT', undefined, { ip: '1.2.3.4' }, NOW).catch((e: unknown) => e);
    expect([statusOf(error), codeOf(error)]).toEqual([429, 'REPORTS_PAUSED']);
    expect(((error as HttpException).getResponse() as { details: { retryAfterSeconds: number } }).details.retryAfterSeconds).toBe(12 * 3600);
    expect(prisma.quoteReport.count.mock.calls[0]![0].where.createdAt.gte.toISOString()).toBe('2026-11-09T00:00:00.000Z');
    expect(prisma.quoteReport.create).not.toHaveBeenCalled();
  });

  it(`never turns the open flag HIGH, however many reporters (round 7, E1), keeping ${REPORT_LIMITS.flagEntries} entries`, async () => {
    const { service, prisma } = setup();
    const old = Array.from({ length: REPORT_LIMITS.flagEntries }, (_, i) => ({ reason: 'TEXT', note: `n${i}`, at: NOW.toISOString() }));
    prisma.quoteFlag.findFirst.mockResolvedValue({ id: 'f1', createdAt: new Date('2026-11-01T00:00:00.000Z'), details: { total: 57, reports: old } });
    prisma.quoteReport.findMany.mockResolvedValueOnce([{ reporterKey: 'a' }, { reporterKey: 'b' }]);
    await service.report(QUOTE, 'GRADE', undefined, { ip: '1.2.3.4' }, NOW);
    let update = prisma.quoteFlag.update.mock.calls[0]![0].data;
    expect(update.severity).toBe('MEDIUM');
    expect(update.details.total).toBe(58);
    expect(update.details.reports).toHaveLength(REPORT_LIMITS.flagEntries);
    expect(update.details.reports.at(-1)).toMatchObject({ reason: 'GRADE' });
    expect(prisma.quoteReport.findMany.mock.calls[0]![0]).toMatchObject({ distinct: ['reporterKey'], take: REPORT_LIMITS.reporterCountCap });

    prisma.quoteReport.findMany.mockResolvedValueOnce([{ reporterKey: 'a' }, { reporterKey: 'b' }, { reporterKey: 'c' }]);
    await service.report(QUOTE, 'ISNAD', undefined, { ip: '5.6.7.8' }, NOW);
    update = prisma.quoteFlag.update.mock.calls[1]![0].data;
    expect(update.severity).toBe('MEDIUM');
    expect(update.details.reporters).toBe(3);
  });

  it('locks the text row before writing, so two first reports cannot open two flags', async () => {
    const { service, prisma } = setup();
    await service.report(QUOTE, 'TEXT', undefined, { ip: '1.2.3.4' }, NOW);
    expect(prisma.$queryRaw.mock.invocationCallOrder[0]!).toBeLessThan(prisma.quoteReport.create.mock.invocationCallOrder[0]!);
  });
});
