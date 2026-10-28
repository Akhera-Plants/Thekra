import { BadRequestException, Injectable } from '@nestjs/common';
import {
  addDays,
  buildIcs,
  diffDays,
  isValidDate,
  occurrences,
  occurrencesToEvents,
  toHijri,
  type IcsEvent,
  type LocalDate,
} from '@thekra/practice-core';
import type { AppLocale } from '../../common/dto/locale-query.dto.js';
import type { QuoteDto } from '../../common/mappers/quote.mapper.js';
import { PUBLIC_SITE_ORIGIN } from '../../config/cors-origins.js';
import { QuotesService } from '../quotes/quotes.service.js';
import { DEFAULT_ICS_MONTHS } from './dto/occasions-ics-query.dto.js';
import type { OccasionsQueryDto } from './dto/occasions-query.dto.js';
import type { OccasionOccurrenceDto } from './entities/practice.entity.js';
import { practiceCatalog, type Occasion, type PracticeCatalog } from './practice-catalog.js';

/** GET /calendar/occasions without `to`: one year from `from`. */
const DEFAULT_OCCASION_DAYS = 365;
/** Longest `from`…`to` span the occasions list accepts. */
export const MAX_OCCASION_SPAN_DAYS = 400;

const CALENDAR_NAME: Record<AppLocale, string> = {
  ar: 'ذكرى: المناسبات المسنونة',
  en: 'Thekra: sunnah occasions',
};
/** Subscribed calendars re-read the feed about daily; it lists only the coming months. */
const ICS_REFRESH_LINES = ['REFRESH-INTERVAL;VALUE=DURATION:P1D', 'X-PUBLISHED-TTL:P1D'];
const UID_SUFFIX = `@${new URL(PUBLIC_SITE_ORIGIN).host}`;

/** The current UTC calendar day. */
export function utcToday(now = new Date()): LocalDate {
  return now.toISOString().slice(0, 10);
}

/** `date` plus whole months, the day clamped to the target month's length. */
export function addMonths(date: LocalDate, months: number): LocalDate {
  const [year, month, day] = date.split('-').map(Number) as [number, number, number];
  const lastDay = new Date(Date.UTC(year, month - 1 + months + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month - 1 + months, Math.min(day, lastDay))).toISOString().slice(0, 10);
}

/** The public page of a good deed (Arabic is the default locale and has no prefix). */
export function deedPageUrl(slug: string, lang: AppLocale): string {
  return `${PUBLIC_SITE_ORIGIN}${lang === 'en' ? '/en' : ''}/good-deeds/${encodeURIComponent(slug)}`;
}

function badRange(code: string, message: string): BadRequestException {
  return new BadRequestException({ code, message });
}

@Injectable()
export class PracticeService {
  constructor(private readonly quotes: QuotesService) {}

  catalog(): PracticeCatalog {
    return practiceCatalog();
  }

  /** The published texts behind catalog `evidence` ids, in the order asked (duplicates once). */
  evidence(ids: readonly string[], lang: AppLocale): Promise<QuoteDto[]> {
    return this.quotes.findPublishedByIds([...new Set(ids.map((id) => id.toLowerCase()))], lang);
  }

  /** Every day of every occasion from `from` to `to` (both inclusive), sorted by date, then catalog order. */
  occasions(query: OccasionsQueryDto, today: LocalDate = utcToday()): OccasionOccurrenceDto[] {
    const from = query.from ?? today;
    const to = query.to ?? (isValidDate(from) ? addDays(from, DEFAULT_OCCASION_DAYS) : from);
    if (!isValidDate(from) || !isValidDate(to)) {
      throw badRange('VALIDATION_FAILED', 'from and to must be real dates (YYYY-MM-DD)');
    }
    const span = diffDays(from, to);
    if (span < 0) throw badRange('DATE_RANGE_INVALID', 'from must not be after to');
    if (span > MAX_OCCASION_SPAN_DAYS) {
      throw badRange('DATE_RANGE_TOO_LONG', `from and to may be at most ${MAX_OCCASION_SPAN_DAYS} days apart`);
    }
    const hijriOffset = query.hijriOffset ?? 0;
    const days = practiceCatalog().occasions.flatMap((occasion) =>
      occurrences(occasion.rule, from, to, { hijriOffset }).map((date) => toOccurrence(occasion, date, hijriOffset)),
    );
    // Array#sort is stable, so occasions on the same day keep the catalog order.
    return days.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  }

  /**
   * The public, subscribable calendar (webcal://…/v1/calendar/occasions.ics): every occasion day from
   * today for `months` months as an all-day event titled in `lang`, linking to the deed's page. It is the
   * same file for everyone and carries no personal data.
   */
  occasionsIcs(lang: AppLocale, months = DEFAULT_ICS_MONTHS, today: LocalDate = utcToday(), now = new Date()): string {
    const to = addDays(addMonths(today, months), -1);
    const events: IcsEvent[] = practiceCatalog().occasions.flatMap((occasion) => {
      const url = deedPageUrl(occasion.deed, lang);
      return occurrencesToEvents(occasion.rule, today, to, {
        uidPrefix: `occasion-${occasion.key}-${lang}`,
        uidSuffix: UID_SUFFIX,
        title: lang === 'en' ? occasion.titleEn : occasion.titleAr,
        description: url,
        url,
      });
    });
    events.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    const ics = buildIcs({
      calendarName: CALENDAR_NAME[lang],
      events,
      prodId: `-//Thekra//occasions//${lang.toUpperCase()}`,
      now,
    });
    return ics.replace('METHOD:PUBLISH\r\n', `METHOD:PUBLISH\r\n${ICS_REFRESH_LINES.map((line) => `${line}\r\n`).join('')}`);
  }
}

function toOccurrence(occasion: Occasion, date: LocalDate, hijriOffset: number): OccasionOccurrenceDto {
  return {
    key: occasion.key,
    date,
    titleAr: occasion.titleAr,
    titleEn: occasion.titleEn,
    deed: occasion.deed,
    basis: occasion.basis,
    hijri: toHijri(date, hijriOffset),
  };
}
