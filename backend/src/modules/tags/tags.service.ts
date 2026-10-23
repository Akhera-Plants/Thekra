import { Injectable, NotFoundException } from '@nestjs/common';
import type { CreateTagDto } from './dto/create-tag.dto.js';
import type { UpdateTagDto } from './dto/update-tag.dto.js';
import { Prisma } from '@prisma/client';
import { paginated } from '../../common/dto/paginated-result.js';
import { findIdsByNormalizedArabic } from '../../common/text/arabic-search.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { TagDetailQueryDto } from './dto/tag-detail-query.dto.js';
import type { TagsQueryDto } from './dto/tags-query.dto.js';
import type { TagWithQuoteCountDto } from './entities/tag.entity.js';

type TagRowWithCount = {
  id: string;
  name: string;
  nameAr: string | null;
  slug: string;
  category: TagWithQuoteCountDto['category'];
  _count: { quotes: number };
};

@Injectable()
export class TagsService {
  constructor(private readonly prisma: PrismaService) {}

  toTagDto(row: TagRowWithCount): TagWithQuoteCountDto {
    return {
      id: row.id,
      name: row.name,
      nameAr: row.nameAr,
      slug: row.slug,
      category: row.category,
      quoteCount: row._count.quotes,
    };
  }

  async findAll(query: TagsQueryDto) {
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

    return paginated(
      rows.map((row) => this.toTagDto(row as TagRowWithCount)),
      page,
      limit,
      total,
      {
        locale,
        appliedFilters: {
          category: query.category ?? null,
          q: query.q ?? null,
        },
      },
    );
  }

  async findBySlug(slug: string, _query: TagDetailQueryDto) {
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

    return this.toTagDto(row as TagRowWithCount);
  }

  // ─── Admin CRUD ───────────────────────────────────────────────────────────────

  async adminCreate(dto: CreateTagDto): Promise<TagWithQuoteCountDto> {
    // Will throw P2002 → 409 if slug is duplicate
    const row = await this.prisma.tag.create({
      data: dto,
      include: { _count: { select: { quotes: true } } },
    });
    return this.toTagDto(row as TagRowWithCount);
  }

  async adminUpdate(id: string, dto: UpdateTagDto): Promise<TagWithQuoteCountDto> {
    const existing = await this.prisma.tag.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException({ code: 'RESOURCE_NOT_FOUND', message: 'Tag not found' });
    }
    const row = await this.prisma.tag.update({
      where: { id },
      data: dto,
      include: { _count: { select: { quotes: true } } },
    });
    return this.toTagDto(row as TagRowWithCount);
  }

  async adminDelete(id: string): Promise<void> {
    const existing = await this.prisma.tag.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException({ code: 'RESOURCE_NOT_FOUND', message: 'Tag not found' });
    }
    // QuoteTag rows cascade-delete via onDelete: Cascade in schema
    await this.prisma.tag.delete({ where: { id } });
  }

  private async buildListWhere(query: TagsQueryDto): Promise<Prisma.TagWhereInput> {
    const and: Prisma.TagWhereInput[] = [];

    if (query.category) {
      and.push({ category: query.category });
    }

    if (query.q) {
      // Arabic field: match via DB-side normalisation (strips tashkeel, folds alef/ya/ta-marbuta)
      // Latin fields (name, slug): standard Prisma ILIKE
      const arabicIds = await findIdsByNormalizedArabic(
        this.prisma,
        '"Tag"',
        '"nameAr"',
        query.q,
      );
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
}
