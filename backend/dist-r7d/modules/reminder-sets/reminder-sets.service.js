var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { QuotesService } from '../quotes/quotes.service.js';
import { eligibleQuoteClause } from './reminder-set-rules.js';
const notFound = () => new NotFoundException({ code: 'RESOURCE_NOT_FOUND', message: 'Reminder set not found' });
let ReminderSetsService = class ReminderSetsService {
    prisma;
    quotes;
    constructor(prisma, quotes) {
        this.prisma = prisma;
        this.quotes = quotes;
    }
    summary(row, itemCount) {
        return {
            id: row.id,
            slug: row.slug,
            titleAr: row.titleAr,
            titleEn: row.titleEn,
            sortOrder: row.sortOrder,
            published: row.published,
            itemCount,
        };
    }
    async findPublished(locale) {
        const rows = await this.prisma.reminderSet.findMany({
            where: { published: true },
            orderBy: [{ sortOrder: 'asc' }, { slug: 'asc' }],
            include: { items: { orderBy: { position: 'asc' }, select: { quoteId: true } } },
        });
        const allIds = [...new Set(rows.flatMap((row) => row.items.map((item) => item.quoteId)))];
        const quotes = await this.quotes.findPublishedByIds(allIds, locale);
        const byId = new Map(quotes.map((quote) => [quote.id, quote]));
        const data = rows.flatMap((row) => {
            const items = row.items.flatMap((item) => byId.get(item.quoteId) ?? []);
            return items.length > 0 ? [{ ...this.summary(row, items.length), items }] : [];
        });
        return { data };
    }
    async findPublishedBySlug(slug, locale) {
        const row = await this.prisma.reminderSet.findFirst({
            where: { slug, published: true },
            include: { items: { orderBy: { position: 'asc' }, select: { quoteId: true } } },
        });
        if (!row)
            throw notFound();
        const items = await this.quotes.findPublishedByIds(row.items.map((item) => item.quoteId), locale);
        return { data: { ...this.summary(row, items.length), items } };
    }
    toAdmin(row) {
        return { ...this.summary(row, row.items.length), quoteIds: row.items.map((item) => item.quoteId) };
    }
    async adminList() {
        const rows = await this.prisma.reminderSet.findMany({
            orderBy: [{ sortOrder: 'asc' }, { slug: 'asc' }],
            include: { items: { orderBy: { position: 'asc' }, select: { quoteId: true } } },
        });
        return { data: rows.map((row) => this.toAdmin(row)) };
    }
    async adminFind(id) {
        const row = await this.prisma.reminderSet.findUnique({
            where: { id },
            include: { items: { orderBy: { position: 'asc' }, select: { quoteId: true } } },
        });
        if (!row)
            throw notFound();
        const items = await this.quotes.findPublishedByIds(row.items.map((item) => item.quoteId), 'ar');
        return { data: { ...this.toAdmin(row), items } };
    }
    async adminCreate(dto) {
        const row = await this.prisma.reminderSet.create({
            data: { slug: dto.slug, titleAr: dto.titleAr, titleEn: dto.titleEn, sortOrder: dto.sortOrder ?? 0, published: dto.published ?? false },
            include: { items: { select: { quoteId: true } } },
        });
        return this.toAdmin(row);
    }
    async adminUpdate(id, dto) {
        const existing = await this.prisma.reminderSet.findUnique({ where: { id } });
        if (!existing)
            throw notFound();
        const row = await this.prisma.reminderSet.update({
            where: { id },
            data: dto,
            include: { items: { orderBy: { position: 'asc' }, select: { quoteId: true } } },
        });
        return this.toAdmin(row);
    }
    async adminDelete(id) {
        const existing = await this.prisma.reminderSet.findUnique({ where: { id } });
        if (!existing)
            throw notFound();
        await this.prisma.reminderSet.delete({ where: { id } });
    }
    async ineligibleIds(ids) {
        if (ids.length === 0)
            return [];
        const ok = await this.prisma.quote.findMany({ where: eligibleQuoteClause(ids), select: { id: true } });
        const okIds = new Set(ok.map((row) => row.id));
        return ids.filter((id) => !okIds.has(id));
    }
    async adminSetItems(id, quoteIds) {
        const existing = await this.prisma.reminderSet.findUnique({ where: { id } });
        if (!existing)
            throw notFound();
        const refused = await this.ineligibleIds(quoteIds);
        if (refused.length > 0) {
            throw new UnprocessableEntityException({
                code: 'REMINDER_SET_QUOTE_NOT_ALLOWED',
                message: 'Only published Quran verses and sahih/hasan hadith may be added',
                details: { quoteIds: refused },
            });
        }
        const row = await this.prisma.$transaction(async (tx) => {
            await tx.reminderSetItem.deleteMany({ where: { setId: id } });
            if (quoteIds.length > 0) {
                await tx.reminderSetItem.createMany({ data: quoteIds.map((quoteId, position) => ({ setId: id, quoteId, position })) });
            }
            return tx.reminderSet.update({
                where: { id },
                data: { updatedAt: new Date() },
                include: { items: { orderBy: { position: 'asc' }, select: { quoteId: true } } },
            });
        });
        return this.toAdmin(row);
    }
};
ReminderSetsService = __decorate([
    Injectable(),
    __metadata("design:paramtypes", [PrismaService,
        QuotesService])
], ReminderSetsService);
export { ReminderSetsService };
//# sourceMappingURL=reminder-sets.service.js.map