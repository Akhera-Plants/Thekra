var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { QuotesService } from '../quotes/quotes.service.js';
import { topicNames } from '../taxonomy/topic-pairs.js';
import { nameOfAllahBySlug, namesOfAllah, nameWordPattern } from './names-of-allah.js';
export const OTHER_VERSES_MAX = 10;
const CANDIDATES = 40;
const ACTION_NAMES = {
    'leave-sin': { ar: 'تخفَّف', en: 'Lighten' },
};
function listItem(name) {
    return { number: name.number, slug: name.slug, nameAr: name.nameAr, ref: name.ref };
}
let NamesOfAllahService = class NamesOfAllahService {
    prisma;
    quotes;
    constructor(prisma, quotes) {
        this.prisma = prisma;
        this.quotes = quotes;
    }
    findAll() {
        return { data: namesOfAllah().names.map(listItem) };
    }
    async findBySlug(slug, lang) {
        const name = nameOfAllahBySlug(slug);
        if (!name) {
            throw new NotFoundException({ code: 'RESOURCE_NOT_FOUND', message: 'Name not found' });
        }
        const file = namesOfAllah();
        const [verse, otherVerses] = await Promise.all([
            this.quotes.findPublishedByIds([name.quoteId], lang).then((items) => items[0] ?? null),
            this.otherVerses(name, lang),
        ]);
        const index = name.number - 1;
        const prev = file.names[index - 1];
        const next = file.names[index + 1];
        return {
            data: {
                ...listItem(name),
                meaningAr: name.meaningAr,
                meaningEn: name.meaningEn,
                review: file.review,
                verse,
                links: name.links.map((link) => {
                    const names = link.kind === 'action' ? ACTION_NAMES[link.slug] : topicNames(link.slug);
                    return { kind: link.kind, slug: link.slug, nameAr: names?.ar ?? link.slug, name: names?.en ?? link.slug };
                }),
                otherVerses,
                prev: prev ? listItem(prev) : null,
                next: next ? listItem(next) : null,
            },
        };
    }
    async otherVerses(name, lang) {
        const rows = await this.prisma.$queryRaw(Prisma.sql `
      SELECT id
      FROM   "Quote"
      WHERE  type = 'QURAN_VERSE'
        AND  id <> ${name.quoteId}
        AND  thekra_normalize_ar("textAr") ~ ${nameWordPattern(name)}
      ORDER  BY "surahNumber" ASC NULLS LAST, "ayahNumber" ASC NULLS LAST, id ASC
      LIMIT  ${CANDIDATES}
    `);
        const items = await this.quotes.findPublishedByIds(rows.map((row) => row.id), lang);
        return items.slice(0, OTHER_VERSES_MAX);
    }
};
NamesOfAllahService = __decorate([
    Injectable(),
    __metadata("design:paramtypes", [PrismaService,
        QuotesService])
], NamesOfAllahService);
export { NamesOfAllahService };
//# sourceMappingURL=names-of-allah.service.js.map