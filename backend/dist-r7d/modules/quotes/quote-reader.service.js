var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { Injectable } from '@nestjs/common';
import { ExplanationKind, LinkReviewStatus, QuoteType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { QuotesService } from './quotes.service.js';
export const READER_TAFSIRS = [
    { key: 'mukhtasar', sourceId: '10000000-0000-4000-8000-000000000025' },
    { key: 'sadi', sourceId: '10000000-0000-4000-8000-000000000013' },
    { key: 'ibn-ashur', sourceId: '10000000-0000-4000-8000-000000000014' },
];
let QuoteReaderService = class QuoteReaderService {
    prisma;
    quotes;
    constructor(prisma, quotes) {
        this.prisma = prisma;
        this.quotes = quotes;
    }
    async read(quoteId, lang, linkId) {
        const [{ quote, rows }, reminderAngle] = await Promise.all([
            this.quotes.publicExplanationRows(quoteId, lang),
            linkId ? this.reminderAngle(quoteId, linkId, lang) : Promise.resolve(null),
        ]);
        const tafsirs = [];
        const explanations = [];
        if (quote.type === QuoteType.QURAN_VERSE) {
            for (const tafsir of READER_TAFSIRS) {
                const own = rows.filter((row) => row.kind === ExplanationKind.TAFSIR && row.sourceId === tafsir.sourceId);
                const inLang = own.filter((row) => row.languageCode === lang);
                const chosen = inLang.length > 0 ? inLang : own.filter((row) => row.languageCode === 'ar');
                if (chosen.length === 0)
                    continue;
                tafsirs.push({
                    key: tafsir.key,
                    source: chosen[0].source,
                    languageCode: chosen[0].languageCode,
                    entries: chosen.map((row) => ({ id: row.id, ayahKey: row.ayahKey, text: row.text, reference: row.reference })),
                });
            }
        }
        else {
            for (const row of rows) {
                if (row.kind === ExplanationKind.TAFSIR)
                    continue;
                explanations.push({ id: row.id, kind: row.kind, languageCode: row.languageCode, text: row.text, reference: row.reference, source: row.source });
            }
        }
        return { data: { quoteId: quote.id, type: quote.type, reminderAngle, tafsirs, explanations } };
    }
    async reminderAngle(quoteId, linkId, lang) {
        const where = { id: linkId, quoteId, reviewStatus: LinkReviewStatus.ACCEPTED };
        const select = { reminderAngle: true, reminderAngleEn: true };
        const [sin, deed, branch] = await Promise.all([
            this.prisma.sinQuote.findFirst({ where, select }),
            this.prisma.goodDeedQuote.findFirst({ where, select }),
            this.prisma.imanBranchQuote.findFirst({ where, select }),
        ]);
        const link = sin ?? deed ?? branch;
        const text = lang === 'en' ? link?.reminderAngleEn : link?.reminderAngle;
        return text ? { text, languageCode: lang } : null;
    }
};
QuoteReaderService = __decorate([
    Injectable(),
    __metadata("design:paramtypes", [PrismaService,
        QuotesService])
], QuoteReaderService);
export { QuoteReaderService };
//# sourceMappingURL=quote-reader.service.js.map