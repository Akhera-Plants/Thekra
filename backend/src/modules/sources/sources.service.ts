import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { paginated } from '../../common/dto/paginated-result.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { GradePolicy } from '../hadith/grade-policy.js';
import type { CreateSourceDto } from './dto/create-source.dto.js';
import type { SourcesQueryDto } from './dto/sources-query.dto.js';
import type { UpdateSourceDto } from './dto/update-source.dto.js';
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

  toSourceDto(row: SourceRowWithCount, publishedQuoteCount = row._count.quotes): SourceDto {
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
      publishedQuoteCount,
    };
  }

  private publishedWhere(): Prisma.QuoteWhereInput {
    return {
      AND: [GradePolicy.readerClause(), GradePolicy.whereClause(GradePolicy.defaultAllowedGrades())],
    };
  }

  async findAll(query: SourcesQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const locale = query.lang ?? 'ar';
    const where = this.buildListWhere(query);

    const [rows, total, published] = await this.prisma.$transaction([
      this.prisma.source.findMany({
        where,
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
        include: { _count: { select: { quotes: true } } },
      }),
      this.prisma.source.count({ where }),
      this.prisma.quote.groupBy({
        by: ['sourceId'],
        where: this.publishedWhere(),
        _count: { _all: true },
      }),
    ]);
    const publishedBySource = new Map(published.map((row) => [row.sourceId, row._count._all]));

    return paginated(
      rows.map((row) => this.toSourceDto(row as SourceRowWithCount, publishedBySource.get(row.id) ?? 0)),
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

    const publishedQuoteCount = await this.prisma.quote.count({
      where: { sourceId: id, ...this.publishedWhere() },
    });
    return this.toSourceDto(row as SourceRowWithCount, publishedQuoteCount);
  }

  // ─── Admin CRUD ───────────────────────────────────────────────────────────────

  async adminCreate(dto: CreateSourceDto): Promise<SourceDto> {
    // P3-4: when isExternalApi=true the caller must provide both apiProvider and apiBaseUrl.
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
    return this.toSourceDto(row as SourceRowWithCount);
  }

  async adminUpdate(id: string, dto: UpdateSourceDto): Promise<SourceDto> {
    const existing = await this.prisma.source.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException({ code: 'RESOURCE_NOT_FOUND', message: 'Source not found' });
    }

    // P3-4: after merging the PATCH body onto the existing row, re-validate the
    // isExternalApi constraint so it holds regardless of which fields are sent.
    const mergedIsExternalApi =
      dto.isExternalApi !== undefined ? dto.isExternalApi : existing.isExternalApi;
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
    return this.toSourceDto(row as SourceRowWithCount);
  }

  async adminDelete(id: string): Promise<void> {
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
