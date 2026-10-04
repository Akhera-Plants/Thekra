import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { paginated } from '../../common/dto/paginated-result.js';
import { normalizeArabic } from '../../common/text/arabic-normalizer.js';
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
    const where = this.buildListWhere(query);

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.tag.findMany({
        where,
        orderBy: { slug: 'asc' },
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

  private buildListWhere(query: TagsQueryDto): Prisma.TagWhereInput {
    const and: Prisma.TagWhereInput[] = [];

    if (query.category) {
      and.push({ category: query.category });
    }

    if (query.q) {
      const normalized = normalizeArabic(query.q);
      and.push({
        OR: [
          { name: { contains: query.q, mode: 'insensitive' } },
          { nameAr: { contains: normalized, mode: 'insensitive' } },
          { slug: { contains: query.q, mode: 'insensitive' } },
        ],
      });
    }

    return and.length ? { AND: and } : {};
  }
}
