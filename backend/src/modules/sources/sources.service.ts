import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { paginated } from '../../common/dto/paginated-result.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { SourcesQueryDto } from './dto/sources-query.dto.js';
import type { SourceDto } from './entities/source.entity.js';

type SourceRowWithCount = {
  id: string;
  name: string;
  nameAr: string | null;
  type: SourceDto['type'];
  author: string | null;
  authorAr: string | null;
  language: string;
  isExternalApi: boolean;
  apiProvider: string | null;
  apiBaseUrl: string | null;
  lastSyncedAt: Date | null;
  _count: { quotes: number };
};

@Injectable()
export class SourcesService {
  constructor(private readonly prisma: PrismaService) {}

  toSourceDto(row: SourceRowWithCount): SourceDto {
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
      quoteCount: row._count.quotes,
    };
  }

  async findAll(query: SourcesQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const locale = query.lang ?? 'ar';
    const where = this.buildListWhere(query);

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.source.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { _count: { select: { quotes: true } } },
      }),
      this.prisma.source.count({ where }),
    ]);

    return paginated(
      rows.map((row) => this.toSourceDto(row as SourceRowWithCount)),
      page,
      limit,
      total,
      {
        locale,
        appliedFilters: {
          type: query.type ?? null,
          isExternalApi: query.isExternalApi ?? null,
        },
      },
    );
  }

  async findById(id: string) {
    const row = await this.prisma.source.findUnique({
      where: { id },
      include: { _count: { select: { quotes: true } } },
    });

    if (!row) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'Source not found',
      });
    }

    return this.toSourceDto(row as SourceRowWithCount);
  }

  private buildListWhere(query: SourcesQueryDto): Prisma.SourceWhereInput {
    const and: Prisma.SourceWhereInput[] = [];

    if (query.type) {
      and.push({ type: query.type });
    }

    if (query.isExternalApi !== undefined) {
      and.push({ isExternalApi: query.isExternalApi });
    }

    return and.length ? { AND: and } : {};
  }
}
