var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { BadRequestException, Injectable } from '@nestjs/common';
import { addDays, buildIcs, diffDays, isValidDate, occurrences, occurrencesToEvents, toHijri, } from '@thekra/practice-core';
import { PUBLIC_SITE_ORIGIN } from '../../config/cors-origins.js';
import { QuotesService } from '../quotes/quotes.service.js';
import { DEFAULT_ICS_MONTHS } from './dto/occasions-ics-query.dto.js';
import { practiceCatalog } from './practice-catalog.js';
const DEFAULT_OCCASION_DAYS = 365;
export const MAX_OCCASION_SPAN_DAYS = 400;
const CALENDAR_NAME = {
    ar: 'ذكرى: المناسبات المسنونة',
    en: 'Thekra: sunnah occasions',
};
const ICS_REFRESH_LINES = ['REFRESH-INTERVAL;VALUE=DURATION:P1D', 'X-PUBLISHED-TTL:P1D'];
const UID_SUFFIX = `@${new URL(PUBLIC_SITE_ORIGIN).host}`;
export function utcToday(now = new Date()) {
    return now.toISOString().slice(0, 10);
}
export function addMonths(date, months) {
    const [year, month, day] = date.split('-').map(Number);
    const lastDay = new Date(Date.UTC(year, month - 1 + months + 1, 0)).getUTCDate();
    return new Date(Date.UTC(year, month - 1 + months, Math.min(day, lastDay))).toISOString().slice(0, 10);
}
export function deedPageUrl(slug, lang) {
    return `${PUBLIC_SITE_ORIGIN}${lang === 'en' ? '/en' : ''}/good-deeds/${encodeURIComponent(slug)}`;
}
function badRange(code, message) {
    return new BadRequestException({ code, message });
}
let PracticeService = class PracticeService {
    quotes;
    constructor(quotes) {
        this.quotes = quotes;
    }
    catalog() {
        return practiceCatalog();
    }
    evidence(ids, lang) {
        return this.quotes.findPublishedByIds([...new Set(ids.map((id) => id.toLowerCase()))], lang);
    }
    occasions(query, today = utcToday()) {
        const from = query.from ?? today;
        const to = query.to ?? (isValidDate(from) ? addDays(from, DEFAULT_OCCASION_DAYS) : from);
        if (!isValidDate(from) || !isValidDate(to)) {
            throw badRange('VALIDATION_FAILED', 'from and to must be real dates (YYYY-MM-DD)');
        }
        const span = diffDays(from, to);
        if (span < 0)
            throw badRange('DATE_RANGE_INVALID', 'from must not be after to');
        if (span > MAX_OCCASION_SPAN_DAYS) {
            throw badRange('DATE_RANGE_TOO_LONG', `from and to may be at most ${MAX_OCCASION_SPAN_DAYS} days apart`);
        }
        const hijriOffset = query.hijriOffset ?? 0;
        const days = practiceCatalog().occasions.flatMap((occasion) => occurrences(occasion.rule, from, to, { hijriOffset }).map((date) => toOccurrence(occasion, date, hijriOffset)));
        return days.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    }
    occasionsIcs(lang, months = DEFAULT_ICS_MONTHS, today = utcToday(), now = new Date()) {
        const to = addDays(addMonths(today, months), -1);
        const events = practiceCatalog().occasions.flatMap((occasion) => {
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
};
PracticeService = __decorate([
    Injectable(),
    __metadata("design:paramtypes", [QuotesService])
], PracticeService);
export { PracticeService };
function toOccurrence(occasion, date, hijriOffset) {
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
//# sourceMappingURL=practice.service.js.map