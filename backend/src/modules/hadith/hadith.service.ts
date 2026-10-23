import { Injectable } from '@nestjs/common';
import { Prisma, QuoteType, SourceType } from '@prisma/client';
import { paginated } from '../../common/dto/paginated-result.js';
import { findIdsByNormalizedArabic } from '../../common/text/arabic-search.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { QuotesService } from '../quotes/quotes.service.js';
import type { HadithCollectionsQueryDto } from './dto/hadith-collections-query.dto.js';
import type { HadithQueryDto } from './dto/hadith-query.dto.js';
import type { HadithCollectionDto } from './entities/hadith-collection.entity.js';
import { GradePolicy } from './grade-policy.js';

@Injectable()
export class HadithService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly quotes: QuotesService,
  ) {}

  async findAll(query: HadithQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const locale = query.lang ?? 'ar';
    const allowedGrades = GradePolicy.resolveAllowedGrades({
      grades: query.grades,
      includeWeak: query.includeWeak,
    });

    const and: Prisma.QuoteWhereInput[] = [
      { type: QuoteType.HADITH },
      GradePolicy.whereClause(allowedGrades),
      GradePolicy.readerClause(),
    ];

    if (query.collectionId) {
      and.push({ sourceId: query.collectionId });
    }
    if (query.narrator) {
      // narratorAr: DB-side normalisation; narrator (Latin): standard ILIKE
      const narratorArIds = await findIdsByNormalizedArabic(
        this.prisma,
        '"Quote"',
        '"narratorAr"',
        query.narrator,
      );
      and.push({
        OR: [
          { narrator: { contains: query.narrator, mode: 'insensitive' } },
          ...(narratorArIds.length > 0 ? [{ id: { in: narratorArIds } }] : []),
        ],
      });
    }
    if (query.reference) {
      const asNumber = Number(query.reference);
      and.push({
        OR: [
          { hadithReference: { contains: query.reference, mode: 'insensitive' } },
          { referenceLabel: { contains: query.reference, mode: 'insensitive' } },
          ...(Number.isInteger(asNumber) ? [{ referenceNumber: asNumber }] : []),
        ],
      });
    }
    if (query.q) {
      // textAr: DB-side normalisation; translation text: standard ILIKE
      const textArIds = await findIdsByNormalizedArabic(
        this.prisma,
        '"Quote"',
        '"textAr"',
        query.q,
      );
      const textFilter: Prisma.QuoteWhereInput[] =
        textArIds.length > 0 ? [{ id: { in: textArIds } }] : [];
      if (locale !== 'ar') {
        textFilter.push({
          translations: {
            some: {
              languageCode: locale,
              text: { contains: query.q, mode: 'insensitive' },
            },
          },
        });
      }
      if (textFilter.length > 0) {
        and.push({ OR: textFilter });
      }
    }

    const where: Prisma.QuoteWhereInput = { AND: and };

    const [rows, total] = await Promise.all([
      this.prisma.quote.findMany({
        where,
        include: this.quotes.buildQuoteInclude(locale),
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.quote.count({ where }),
    ]);

    return paginated(
      rows.map((row) =>
        this.quotes.toQuoteDto(row , locale),
      ),
      page,
      limit,
      total,
      {
        locale,
        appliedGrades: allowedGrades,
        appliedFilters: {
          collectionId: query.collectionId ?? null,
          narrator: query.narrator ?? null,
          q: query.q ?? null,
          reference: query.reference ?? null,
        },
      },
    );
  }

  async listCollections(_query: HadithCollectionsQueryDto) {
    const rows = await this.prisma.source.findMany({
      where: { type: SourceType.HADITH_COLLECTION },
      orderBy: { name: 'asc' },
      include: { _count: { select: { quotes: { where: GradePolicy.readerClause() } } } },
    });

    const data: HadithCollectionDto[] = rows.map((row) => ({
      id: row.id,
      name: row.name,
      nameAr: row.nameAr,
      author: row.author,
      authorAr: row.authorAr,
      isExternalApi: row.isExternalApi,
      apiProvider: row.apiProvider,
      quoteCount: row._count.quotes,
      lastSyncedAt: row.lastSyncedAt,
    }));

    return { data };
  }
}
