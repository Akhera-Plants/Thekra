var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { paginated } from '../../common/dto/paginated-result.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { GradePolicy } from '../hadith/grade-policy.js';
let SourcesService = class SourcesService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    toSourceDto(row, publishedQuoteCount = row._count.quotes) {
        const imported = row._count.quotes + (row._count.explanations ?? 0);
        return {
            id: row.id,
            name: row.name,
            nameAr: row.nameAr,
            type: row.type,
            author: row.author,
            authorAr: row.authorAr,
            language: row.language,
            isExternalApi: row.isExternalApi,
            apiProvider: row.apiProvider,
            apiBaseUrl: row.apiBaseUrl,
            lastSyncedAt: row.lastSyncedAt,
            quoteCount: imported,
            publishedQuoteCount,
        };
    }
    publishedWhere() {
        return {
            AND: [GradePolicy.readerClause(), GradePolicy.whereClause(GradePolicy.defaultAllowedGrades())],
        };
    }
    async findAll(query) {
        const page = query.page ?? 1;
        const limit = query.limit ?? 20;
        const locale = query.lang ?? 'ar';
        const where = this.buildListWhere(query);
        const [rows, total, published] = await Promise.all([
            this.prisma.source.findMany({
                where,
                orderBy: [{ name: 'asc' }, { id: 'asc' }],
                skip: (page - 1) * limit,
                take: limit,
                include: { _count: { select: { quotes: true, explanations: true } } },
            }),
            this.prisma.source.count({ where }),
            this.prisma.quote.groupBy({
                by: ['sourceId'],
                where: this.publishedWhere(),
                _count: { _all: true },
            }),
        ]);
        const publishedBySource = new Map(published.map((row) => [row.sourceId, row._count._all]));
        return paginated(rows.map((row) => this.toSourceDto(row, publishedBySource.get(row.id) ?? 0)), page, limit, total, {
            locale,
            appliedFilters: {
                type: query.type ?? null,
                isExternalApi: query.isExternalApi ?? null,
            },
        });
    }
    async findById(id) {
        const row = await this.prisma.source.findUnique({
            where: { id },
            include: { _count: { select: { quotes: true, explanations: true } } },
        });
        if (!row) {
            throw new NotFoundException({
                code: 'RESOURCE_NOT_FOUND',
                message: 'Source not found',
            });
        }
        const canonical = row.canonicalId
            ? await this.prisma.source.findUnique({
                where: { id: row.canonicalId },
                include: { _count: { select: { quotes: true, explanations: true } } },
            })
            : null;
        const shown = canonical ?? row;
        const publishedQuoteCount = await this.prisma.quote.count({
            where: { sourceId: shown.id, ...this.publishedWhere() },
        });
        return this.toSourceDto(shown, publishedQuoteCount);
    }
    async adminCreate(dto) {
        if (dto.isExternalApi && (!dto.apiProvider || !dto.apiBaseUrl)) {
            throw new BadRequestException({
                code: 'VALIDATION_FAILED',
                message: 'apiProvider and apiBaseUrl are required when isExternalApi is true',
            });
        }
        const row = await this.prisma.source.create({
            data: {
                name: dto.name,
                nameAr: dto.nameAr,
                type: dto.type,
                author: dto.author,
                authorAr: dto.authorAr,
                language: dto.language ?? 'ar',
                isExternalApi: dto.isExternalApi ?? false,
                apiProvider: dto.apiProvider,
                apiBaseUrl: dto.apiBaseUrl,
            },
            include: { _count: { select: { quotes: true } } },
        });
        return this.toSourceDto(row);
    }
    async adminUpdate(id, dto) {
        const existing = await this.prisma.source.findUnique({ where: { id } });
        if (!existing) {
            throw new NotFoundException({ code: 'RESOURCE_NOT_FOUND', message: 'Source not found' });
        }
        const mergedIsExternalApi = dto.isExternalApi !== undefined ? dto.isExternalApi : existing.isExternalApi;
        const mergedApiProvider = dto.apiProvider !== undefined ? dto.apiProvider : existing.apiProvider;
        const mergedApiBaseUrl = dto.apiBaseUrl !== undefined ? dto.apiBaseUrl : existing.apiBaseUrl;
        if (mergedIsExternalApi && (!mergedApiProvider || !mergedApiBaseUrl)) {
            throw new BadRequestException({
                code: 'VALIDATION_FAILED',
                message: 'apiProvider and apiBaseUrl are required when isExternalApi is true',
            });
        }
        const row = await this.prisma.source.update({
            where: { id },
            data: dto,
            include: { _count: { select: { quotes: true } } },
        });
        return this.toSourceDto(row);
    }
    async adminDelete(id) {
        const existing = await this.prisma.source.findUnique({ where: { id } });
        if (!existing) {
            throw new NotFoundException({ code: 'RESOURCE_NOT_FOUND', message: 'Source not found' });
        }
        const quoteCount = await this.prisma.quote.count({ where: { sourceId: id } });
        if (quoteCount > 0) {
            throw new ConflictException({
                code: 'SOURCE_HAS_QUOTES',
                message: `Cannot delete source with ${quoteCount} associated quote(s).`,
            });
        }
        await this.prisma.source.delete({ where: { id } });
    }
    buildListWhere(query) {
        const and = [];
        if (query.type) {
            and.push({ type: query.type });
        }
        if (query.isExternalApi !== undefined) {
            and.push({ isExternalApi: query.isExternalApi });
        }
        if (query.isExternalApi !== true) {
            and.push({ canonicalId: null });
        }
        return and.length ? { AND: and } : {};
    }
};
SourcesService = __decorate([
    Injectable(),
    __metadata("design:paramtypes", [PrismaService])
], SourcesService);
export { SourcesService };
//# sourceMappingURL=sources.service.js.map