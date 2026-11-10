var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { Injectable, NotFoundException, UnprocessableEntityException, } from '@nestjs/common';
import { LinkReviewStatus, QuoteType } from '@prisma/client';
import { paginated } from '../../common/dto/paginated-result.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { GradePolicy } from '../hadith/grade-policy.js';
const SIN_LINK_INCLUDE = {
    sin: { select: { slug: true, name: true, nameAr: true } },
    quote: { select: { id: true, type: true, textAr: true } },
};
const GOOD_DEED_LINK_INCLUDE = {
    goodDeed: { select: { slug: true, name: true, nameAr: true } },
    quote: { select: { id: true, type: true, textAr: true } },
};
const BRANCH_LINK_INCLUDE = {
    imanBranch: { select: { number: true, titleAr: true, title: true } },
    quote: { select: { id: true, type: true, textAr: true } },
};
const ADMIN_LINK_ORDER_BY_SCORE = [
    { relevanceScore: { sort: 'desc', nulls: 'last' } },
    { id: 'asc' },
];
const ADMIN_LINK_ORDER_BY_NEWEST = [
    { createdAt: 'desc' },
    { id: 'asc' },
];
const CONCERN_EXCERPT = 200;
const CONCERN_QUOTE_SELECT = { id: true, type: true, textAr: true };
let ClassificationService = class ClassificationService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async linkSinQuote(dto) {
        return this.doLink(this.sinBinding, dto.sinId, dto);
    }
    async listSinQuotes(query) {
        return this.doList(this.sinBinding, query, (q) => this.buildSinQuoteWhere(q));
    }
    async updateSinLink(id, dto) {
        return this.doUpdate(this.sinBinding, id, dto);
    }
    async unlinkSinQuote(id) {
        return this.doUnlink(this.sinBinding, id);
    }
    async bulkLinkSinQuotes(dto) {
        await this.assertSinExists(dto.sinId);
        return this.bulkLink({
            links: dto.links,
            fetchExistingPairs: (quoteIds) => this.prisma.sinQuote.findMany({
                where: { sinId: dto.sinId, quoteId: { in: quoteIds } },
                select: { quoteId: true },
            }),
            buildUpserts: (toWrite) => toWrite.map(({ item }) => this.prisma.sinQuote.upsert({
                where: { sinId_quoteId: { sinId: dto.sinId, quoteId: item.quoteId } },
                create: {
                    sinId: dto.sinId,
                    quoteId: item.quoteId,
                    relevanceScore: item.relevanceScore ?? 0,
                    note: item.note ?? null,
                    reviewStatus: LinkReviewStatus.ACCEPTED,
                },
                update: {
                    ...(item.relevanceScore !== undefined && { relevanceScore: item.relevanceScore }),
                    ...(item.note !== undefined && { note: item.note }),
                    reviewStatus: LinkReviewStatus.ACCEPTED,
                },
            })),
        });
    }
    async linkGoodDeedQuote(dto) {
        return this.doLink(this.goodDeedBinding, dto.goodDeedId, dto);
    }
    async listGoodDeedQuotes(query) {
        return this.doList(this.goodDeedBinding, query, (q) => this.buildGoodDeedQuoteWhere(q));
    }
    async updateGoodDeedLink(id, dto) {
        return this.doUpdate(this.goodDeedBinding, id, dto);
    }
    async unlinkGoodDeedQuote(id) {
        return this.doUnlink(this.goodDeedBinding, id);
    }
    async bulkLinkGoodDeedQuotes(dto) {
        await this.assertGoodDeedExists(dto.goodDeedId);
        return this.bulkLink({
            links: dto.links,
            fetchExistingPairs: (quoteIds) => this.prisma.goodDeedQuote.findMany({
                where: { goodDeedId: dto.goodDeedId, quoteId: { in: quoteIds } },
                select: { quoteId: true },
            }),
            buildUpserts: (toWrite) => toWrite.map(({ item }) => this.prisma.goodDeedQuote.upsert({
                where: { goodDeedId_quoteId: { goodDeedId: dto.goodDeedId, quoteId: item.quoteId } },
                create: {
                    goodDeedId: dto.goodDeedId,
                    quoteId: item.quoteId,
                    relevanceScore: item.relevanceScore ?? 0,
                    note: item.note ?? null,
                    reviewStatus: LinkReviewStatus.ACCEPTED,
                },
                update: {
                    ...(item.relevanceScore !== undefined && { relevanceScore: item.relevanceScore }),
                    ...(item.note !== undefined && { note: item.note }),
                    reviewStatus: LinkReviewStatus.ACCEPTED,
                },
            })),
        });
    }
    async doLink(binding, parentId, dto) {
        await binding.assertParent(parentId);
        await this.assertQuoteExistsAndGradeAllowed(dto.quoteId);
        const compoundWhere = {
            [binding.compoundKeyName]: { [binding.parentKey]: parentId, quoteId: dto.quoteId },
        };
        const existing = await binding.delegate['findUnique']({ where: compoundWhere });
        const link = (await binding.delegate['upsert']({
            where: compoundWhere,
            create: {
                [binding.parentKey]: parentId,
                quoteId: dto.quoteId,
                relevanceScore: dto.relevanceScore ?? 0,
                note: dto.note ?? null,
                reviewStatus: dto.reviewStatus ?? LinkReviewStatus.ACCEPTED,
            },
            update: {
                ...(dto.relevanceScore !== undefined && { relevanceScore: dto.relevanceScore }),
                ...(dto.note !== undefined && { note: dto.note }),
                reviewStatus: dto.reviewStatus ?? LinkReviewStatus.ACCEPTED,
            },
            include: binding.include,
        }));
        return { created: !existing, link };
    }
    async doList(binding, query, buildWhere) {
        const page = query.page ?? 1;
        const limit = query.limit ?? 20;
        const where = buildWhere(query);
        const orderBy = query.sort === 'newest' ? ADMIN_LINK_ORDER_BY_NEWEST : ADMIN_LINK_ORDER_BY_SCORE;
        const findManyOp = binding.delegate['findMany']({
            where,
            orderBy,
            skip: (page - 1) * limit,
            take: limit,
            include: binding.include,
        });
        const countOp = binding.delegate['count']({ where });
        const [rows, total] = await this.prisma.$transaction([findManyOp, countOp]);
        return paginated(rows, page, limit, total);
    }
    async doUpdate(binding, id, dto) {
        const existing = await binding.delegate['findUnique']({ where: { id } });
        if (!existing) {
            throw new NotFoundException({ code: 'RESOURCE_NOT_FOUND', message: binding.notFoundMessage });
        }
        return (await binding.delegate['update']({
            where: { id },
            data: {
                ...(dto.relevanceScore !== undefined && { relevanceScore: dto.relevanceScore }),
                ...(dto.note !== undefined && { note: dto.note }),
                ...(dto.reviewStatus !== undefined && { reviewStatus: dto.reviewStatus }),
                ...(dto.reminderAngle !== undefined && { reminderAngle: dto.reminderAngle }),
                ...(dto.reminderAngleEn !== undefined && { reminderAngleEn: dto.reminderAngleEn }),
                ...(dto.concern !== undefined && { concern: dto.concern, concernAt: dto.concern === null ? null : new Date() }),
                ...(dto.concernNote !== undefined && { concernNote: dto.concernNote }),
            },
            include: binding.include,
        }));
    }
    async doUnlink(binding, id) {
        const existing = await binding.delegate['findUnique']({ where: { id } });
        if (!existing) {
            throw new NotFoundException({ code: 'RESOURCE_NOT_FOUND', message: binding.notFoundMessage });
        }
        await binding.delegate['delete']({ where: { id } });
    }
    async listLinkConcerns(query) {
        const limit = query.limit ?? 100;
        const where = { concern: query.concern ? query.concern : { not: null } };
        const wants = (kind) => query.kind === undefined || query.kind === kind;
        const page = { where, orderBy: [{ concernAt: 'desc' }, { id: 'asc' }], take: limit };
        const base = { id: true, concern: true, concernNote: true, concernAt: true, reviewStatus: true, quote: { select: CONCERN_QUOTE_SELECT } };
        const [sins, deeds, branches, sinCount, deedCount, branchCount] = await Promise.all([
            wants('sin') ? this.prisma.sinQuote.findMany({ ...page, select: { ...base, sin: { select: { slug: true, nameAr: true } } } }) : [],
            wants('good-deed') ? this.prisma.goodDeedQuote.findMany({ ...page, select: { ...base, goodDeed: { select: { slug: true, nameAr: true } } } }) : [],
            wants('branch') ? this.prisma.imanBranchQuote.findMany({ ...page, select: { ...base, imanBranch: { select: { number: true, titleAr: true } } } }) : [],
            wants('sin') ? this.prisma.sinQuote.count({ where }) : 0,
            wants('good-deed') ? this.prisma.goodDeedQuote.count({ where }) : 0,
            wants('branch') ? this.prisma.imanBranchQuote.count({ where }) : 0,
        ]);
        const present = (kind, row, topic) => ({
            kind,
            linkId: row.id,
            concern: row.concern,
            concernNote: row.concernNote,
            concernAt: row.concernAt?.toISOString() ?? null,
            reviewStatus: row.reviewStatus,
            topic,
            quote: { id: row.quote.id, type: row.quote.type, excerpt: row.quote.textAr.slice(0, CONCERN_EXCERPT) },
        });
        const data = [
            ...sins.map((row) => present('sin', row, row.sin)),
            ...deeds.map((row) => present('good-deed', row, row.goodDeed)),
            ...branches.map((row) => present('branch', row, { slug: String(row.imanBranch.number), nameAr: row.imanBranch.titleAr })),
        ].sort((a, b) => (b.concernAt ?? '').localeCompare(a.concernAt ?? '') || a.linkId.localeCompare(b.linkId));
        return { data, meta: { counts: { sin: sinCount, 'good-deed': deedCount, branch: branchCount }, limitPerKind: limit } };
    }
    get sinBinding() {
        return {
            parentKey: 'sinId',
            compoundKeyName: 'sinId_quoteId',
            include: SIN_LINK_INCLUDE,
            assertParent: (id) => this.assertSinExists(id),
            delegate: this.prisma.sinQuote,
            notFoundMessage: 'Sin-quote link not found',
        };
    }
    async linkBranchQuote(dto) {
        return this.doLink(this.branchBinding, dto.imanBranchId, dto);
    }
    async listBranchQuotes(query) {
        return this.doList(this.branchBinding, query, () => {
            const and = [];
            if (query.imanBranchId)
                and.push({ imanBranchId: query.imanBranchId });
            if (query.quoteId)
                and.push({ quoteId: query.quoteId });
            if (query.reviewStatus)
                and.push({ reviewStatus: query.reviewStatus });
            return and.length ? { AND: and } : {};
        });
    }
    async updateBranchLink(id, dto) {
        return this.doUpdate(this.branchBinding, id, dto);
    }
    async unlinkBranchQuote(id) {
        return this.doUnlink(this.branchBinding, id);
    }
    get goodDeedBinding() {
        return {
            parentKey: 'goodDeedId',
            compoundKeyName: 'goodDeedId_quoteId',
            include: GOOD_DEED_LINK_INCLUDE,
            assertParent: (id) => this.assertGoodDeedExists(id),
            delegate: this.prisma.goodDeedQuote,
            notFoundMessage: 'GoodDeed-quote link not found',
        };
    }
    get branchBinding() {
        return {
            parentKey: 'imanBranchId',
            compoundKeyName: 'imanBranchId_quoteId',
            include: BRANCH_LINK_INCLUDE,
            assertParent: (id) => this.assertBranchExists(id),
            delegate: this.prisma.imanBranchQuote,
            notFoundMessage: 'Branch-quote link not found',
        };
    }
    async bulkLink(opts) {
        const { links, fetchExistingPairs, buildUpserts } = opts;
        const failed = [];
        let skipped = 0;
        const seen = new Set();
        const deduplicated = [];
        for (const item of links) {
            if (seen.has(item.quoteId)) {
                skipped++;
            }
            else {
                seen.add(item.quoteId);
                deduplicated.push(item);
            }
        }
        if (deduplicated.length === 0) {
            return { data: { created: 0, updated: 0, skipped, failed } };
        }
        const quoteIds = deduplicated.map((i) => i.quoteId);
        const foundQuotes = await this.prisma.quote.findMany({
            where: { id: { in: quoteIds } },
            select: { id: true, type: true, grade: true },
        });
        const quoteMap = new Map(foundQuotes.map((q) => [q.id, q]));
        const existingPairs = await fetchExistingPairs(quoteIds);
        const existingSet = new Set(existingPairs.map((p) => p.quoteId));
        const toWrite = [];
        for (const item of deduplicated) {
            const quote = quoteMap.get(item.quoteId);
            if (!quote) {
                failed.push({ quoteId: item.quoteId, reason: 'RELATED_RESOURCE_INVALID' });
                continue;
            }
            if (quote.type === QuoteType.HADITH) {
                try {
                    GradePolicy.assertRenderable(quote.grade);
                }
                catch {
                    failed.push({ quoteId: item.quoteId, reason: 'GRADE_NOT_PERMITTED' });
                    continue;
                }
            }
            toWrite.push({ item, isUpdate: existingSet.has(item.quoteId) });
        }
        if (toWrite.length > 0) {
            const ops = buildUpserts(toWrite);
            await this.prisma.$transaction(ops);
        }
        const created = toWrite.filter((w) => !w.isUpdate).length;
        const updated = toWrite.filter((w) => w.isUpdate).length;
        return { data: { created, updated, skipped, failed } };
    }
    async assertSinExists(sinId) {
        const sin = await this.prisma.sin.findUnique({ where: { id: sinId } });
        if (!sin) {
            throw new UnprocessableEntityException({
                code: 'RELATED_RESOURCE_INVALID',
                message: 'Sin not found',
            });
        }
    }
    async assertBranchExists(branchId) {
        const branch = await this.prisma.imanBranch.findUnique({ where: { id: branchId } });
        if (!branch) {
            throw new UnprocessableEntityException({
                code: 'RELATED_RESOURCE_INVALID',
                message: 'Branch not found',
            });
        }
    }
    async assertGoodDeedExists(goodDeedId) {
        const deed = await this.prisma.goodDeed.findUnique({ where: { id: goodDeedId } });
        if (!deed) {
            throw new UnprocessableEntityException({
                code: 'RELATED_RESOURCE_INVALID',
                message: 'GoodDeed not found',
            });
        }
    }
    async assertQuoteExistsAndGradeAllowed(quoteId) {
        const quote = await this.prisma.quote.findUnique({ where: { id: quoteId } });
        if (!quote) {
            throw new UnprocessableEntityException({
                code: 'RELATED_RESOURCE_INVALID',
                message: 'Quote not found',
            });
        }
        if (quote.type === QuoteType.HADITH) {
            GradePolicy.assertRenderable(quote.grade);
        }
    }
    buildSinQuoteWhere(query) {
        const and = [];
        if (query.sinId)
            and.push({ sinId: query.sinId });
        if (query.quoteId)
            and.push({ quoteId: query.quoteId });
        if (query.minScore !== undefined)
            and.push({ relevanceScore: { gte: query.minScore } });
        if (query.maxScore !== undefined)
            and.push({ relevanceScore: { lte: query.maxScore } });
        if (query.hasNote === true)
            and.push({ note: { not: null } });
        if (query.hasNote === false)
            and.push({ note: null });
        if (query.reviewStatus)
            and.push({ reviewStatus: query.reviewStatus });
        if (query.classifiedBy)
            and.push({ classifiedBy: query.classifiedBy });
        return and.length ? { AND: and } : {};
    }
    buildGoodDeedQuoteWhere(query) {
        const and = [];
        if (query.goodDeedId)
            and.push({ goodDeedId: query.goodDeedId });
        if (query.quoteId)
            and.push({ quoteId: query.quoteId });
        if (query.minScore !== undefined)
            and.push({ relevanceScore: { gte: query.minScore } });
        if (query.maxScore !== undefined)
            and.push({ relevanceScore: { lte: query.maxScore } });
        if (query.hasNote === true)
            and.push({ note: { not: null } });
        if (query.hasNote === false)
            and.push({ note: null });
        if (query.reviewStatus)
            and.push({ reviewStatus: query.reviewStatus });
        if (query.classifiedBy)
            and.push({ classifiedBy: query.classifiedBy });
        return and.length ? { AND: and } : {};
    }
    async revokeSinGroup(sinId, classifiedBy) {
        await this.assertSinExists(sinId);
        const result = await this.prisma.sinQuote.updateMany({
            where: { sinId, classifiedBy, reviewStatus: { not: 'REJECTED' } },
            data: { reviewStatus: 'REJECTED' },
        });
        return { revoked: result.count };
    }
    async revokeGoodDeedGroup(goodDeedId, classifiedBy) {
        await this.assertGoodDeedExists(goodDeedId);
        const result = await this.prisma.goodDeedQuote.updateMany({
            where: { goodDeedId, classifiedBy, reviewStatus: { not: 'REJECTED' } },
            data: { reviewStatus: 'REJECTED' },
        });
        return { revoked: result.count };
    }
};
ClassificationService = __decorate([
    Injectable(),
    __metadata("design:paramtypes", [PrismaService])
], ClassificationService);
export { ClassificationService };
//# sourceMappingURL=classification.service.js.map