import { BadRequestException } from '@nestjs/common';
import type { QuotesService } from '../quotes/quotes.service.js';
import { addMonths, deedPageUrl, MAX_OCCASION_SPAN_DAYS, PracticeService, utcToday } from './practice.service.js';

function makeService() {
  const quotes = { findPublishedByIds: vi.fn().mockResolvedValue([]) };
  return { quotes, service: new PracticeService(quotes as unknown as QuotesService) };
}

function codeOf(fn: () => unknown): string | undefined {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(BadRequestException);
    return ((error as BadRequestException).getResponse() as { code?: string }).code;
  }
  return undefined;
}

describe('PracticeService', () => {
  describe('catalog', () => {
    it('returns occasions, habits, sinPrograms { review, common, programs } and the tazkiya prompts', () => {
      const catalog = makeService().service.catalog();
      expect(Object.keys(catalog)).toEqual(['occasions', 'habits', 'sinPrograms', 'tazkiya']);
      expect(catalog.tazkiya.review).toBe('pending-sheikh');
      expect(Object.keys(catalog.sinPrograms)).toEqual(['review', 'common', 'programs']);
    });
  });

  describe('evidence', () => {
    it('asks QuotesService for the published texts once per id, in order, with the locale', async () => {
      const { service, quotes } = makeService();
      const a = '0D77E977-F40B-473B-8B14-42B5FB82951A';
      const b = 'e4a9c1f0-c53a-4f1c-9418-aaf4bbb8cd13';
      await service.evidence([a, b, a.toLowerCase()], 'en');
      expect(quotes.findPublishedByIds).toHaveBeenCalledWith([a.toLowerCase(), b], 'en');
    });
  });

  describe('occasions', () => {
    const service = makeService().service;

    it('lists Arafah 1448 on 2027-05-15 with its Hijri date, sorted by date', () => {
      const days = service.occasions({ from: '2027-05-10', to: '2027-05-20' });
      const arafah = days.find((day) => day.key === 'arafah');
      expect(arafah).toEqual({
        key: 'arafah',
        date: '2027-05-15',
        titleAr: 'صيام يوم عرفة (9 ذو الحجة)',
        titleEn: 'Fasting the Day of Arafah (9 Dhu al-Hijja)',
        deed: 'siyam',
        basis: 'text',
        hijri: { year: 1448, month: 12, day: 9 },
      });
      const dates = days.map((day) => day.date);
      expect(dates).toEqual([...dates].sort());
      expect(days.filter((day) => day.key === 'dhul-hijja-ten').length).toBeGreaterThan(0);
    });

    it('applies hijriOffset (+1: the local month starts a day earlier)', () => {
      const days = service.occasions({ from: '2027-05-10', to: '2027-05-20', hijriOffset: 1 });
      expect(days.find((day) => day.key === 'arafah')?.date).toBe('2027-05-14');
    });

    it('defaults to today (UTC) and one year on', () => {
      const days = service.occasions({}, '2026-10-28');
      expect(days[0]?.date >= '2026-10-28').toBe(true);
      expect(days.at(-1)!.date <= '2027-10-28').toBe(true);
      expect(days.some((day) => day.key === 'arafah' && day.date === '2027-05-15')).toBe(true);
    });

    it('rejects a reversed range, an impossible date and a span over 400 days', () => {
      expect(codeOf(() => service.occasions({ from: '2027-01-02', to: '2027-01-01' }))).toBe('DATE_RANGE_INVALID');
      expect(codeOf(() => service.occasions({ from: '2027-02-30', to: '2027-03-01' }))).toBe('VALIDATION_FAILED');
      expect(codeOf(() => service.occasions({ from: '2027-01-01', to: '2028-02-06' }))).toBe('DATE_RANGE_TOO_LONG');
      expect(service.occasions({ from: '2027-01-01', to: '2028-02-05' }).length).toBeGreaterThan(0);
      expect(MAX_OCCASION_SPAN_DAYS).toBe(400);
    });
  });

  describe('occasionsIcs', () => {
    const service = makeService().service;
    const now = new Date('2026-10-28T09:00:00Z');
    const ar = service.occasionsIcs('ar', 12, '2026-10-28', now);
    const en = service.occasionsIcs('en', 12, '2026-10-28', now);

    it('is a VCALENDAR with CRLF line endings and no line over 75 octets', () => {
      expect(ar.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\n')).toBe(true);
      expect(ar.endsWith('END:VCALENDAR\r\n')).toBe(true);
      expect(ar.replace(/\r\n/g, '')).not.toMatch(/[\r\n]/);
      for (const line of ar.split('\r\n')) expect(Buffer.byteLength(line, 'utf8')).toBeLessThanOrEqual(75);
      expect(ar).toContain('\r\nREFRESH-INTERVAL;VALUE=DURATION:P1D\r\nX-PUBLISHED-TTL:P1D\r\n');
      expect(ar).not.toContain('RRULE');
    });

    it('has an all-day Arafah 1448 event on 2027-05-15 titled in the requested language, linking to the deed page', () => {
      const unfold = (ics: string) => ics.replace(/\r\n /g, '');
      const event = (ics: string) =>
        unfold(ics)
          .split('BEGIN:VEVENT')
          .find((block) => block.includes('UID:occasion-arafah-'));
      expect(event(ar)).toContain('DTSTART;VALUE=DATE:20270515\r\nDTEND;VALUE=DATE:20270516');
      expect(event(ar)).toContain('SUMMARY:صيام يوم عرفة (9 ذو الحجة)');
      expect(event(ar)).toContain(`DESCRIPTION:${deedPageUrl('siyam', 'ar')}`);
      expect(event(en)).toContain('SUMMARY:Fasting the Day of Arafah (9 Dhu al-Hijja)');
      expect(event(en)).toContain('URL:https://thekra-web.vercel.app/en/good-deeds/siyam');
      expect(event(ar)).toContain('UID:occasion-arafah-ar-20270515@thekra-web.vercel.app');
    });

    it('covers `months` months from today and nothing before', () => {
      const dates = [...ar.matchAll(/DTSTART;VALUE=DATE:(\d{8})/g)].map((m) => m[1]!);
      expect(dates.length).toBeGreaterThan(100);
      expect(dates.every((d) => d >= '20261028' && d <= '20271027')).toBe(true);
      const short = service.occasionsIcs('ar', 1, '2026-10-28', now);
      expect([...short.matchAll(/DTSTART;VALUE=DATE:(\d{8})/g)].every((m) => m[1]! <= '20261127')).toBe(true);
    });
  });

  it('date helpers', () => {
    expect(utcToday(new Date('2026-10-28T23:30:00-05:00'))).toBe('2026-10-29');
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2026-10-28', 12)).toBe('2027-10-28');
    expect(deedPageUrl('siyam', 'ar')).toBe('https://thekra-web.vercel.app/good-deeds/siyam');
  });
});
