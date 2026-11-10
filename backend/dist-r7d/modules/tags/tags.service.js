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
import { paginated } from '../../common/dto/paginated-result.js';
import { findIdsByNormalizedArabic } from '../../common/text/arabic-search.js';
import { PrismaService } from '../../prisma/prisma.service.js';
let TagsService = class TagsService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    toTagDto(row) {
        return {
            id: row.id,
            name: row.name,
            nameAr: row.nameAr,
            slug: row.slug,
            category: row.category,
            quoteCount: row._count.quotes,
        };
    }
    async findAll(query) {
        const page = query.page ?? 1;
        const limit = query.limit ?? 20;
        const locale = query.lang ?? 'ar';
        const where = await this.buildListWhere(query);
        const [rows, total] = await Promise.all([
            this.prisma.tag.findMany({
                where,
                orderBy: [{ slug: 'asc' }, { id: 'asc' }],
                skip: (page - 1) * limit,
                take: limit,
                include: { _count: { select: { quotes: true } } },
            }),
            this.prisma.tag.count({ where }),
        ]);
        return paginated(rows.map((row) => this.toTagDto(row)), page, limit, total, {
            locale,
            appliedFilters: {
                category: query.category ?? null,
                q: query.q ?? null,
            },
        });
    }
    async findBySlug(slug, _query) {
        const row = await this.prisma.tag.findUnique({
            where: { slug },
            include: { _count: { select: { quotes: true } } },
        });
        if (!row) {
            throw new NotFoundException({
                code: 'RESOURCE_NOT_FOUND',
                message: 'Tag not found',
            });
        }
        return this.toTagDto(row);
    }
    async adminCreate(dto) {
        const row = await this.prisma.tag.create({
            data: dto,
            include: { _count: { select: { quotes: true } } },
        });
        return this.toTagDto(row);
    }
    async adminUpdate(id, dto) {
        const existing = await this.prisma.tag.findUnique({ where: { id } });
        if (!existing) {
            throw new NotFoundException({ code: 'RESOURCE_NOT_FOUND', message: 'Tag not found' });
        }
        const row = await this.prisma.tag.update({
            where: { id },
            data: dto,
            include: { _count: { select: { quotes: true } } },
        });
        return this.toTagDto(row);
    }
    async adminDelete(id) {
        const existing = await this.prisma.tag.findUnique({ where: { id } });
        if (!existing) {
            throw new NotFoundException({ code: 'RESOURCE_NOT_FOUND', message: 'Tag not found' });
        }
        await this.prisma.tag.delete({ where: { id } });
    }
    async buildListWhere(query) {
        const and = [];
        if (query.category) {
            and.push({ category: query.category });
        }
        if (query.q) {
            const arabicIds = await findIdsByNormalizedArabic(this.prisma, '"Tag"', '"nameAr"', query.q);
            and.push({
                OR: [
                    { name: { contains: query.q, mode: 'insensitive' } },
                    { slug: { contains: query.q, mode: 'insensitive' } },
                    ...(arabicIds.length > 0 ? [{ id: { in: arabicIds } }] : []),
                ],
            });
        }
        return and.length ? { AND: and } : {};
    }
};
TagsService = __decorate([
    Injectable(),
    __metadata("design:paramtypes", [PrismaService])
], TagsService);
export { TagsService };
//# sourceMappingURL=tags.service.js.map