import { Injectable } from '@nestjs/common';
import { HadithGrade, Prisma, QuoteType, SourceType } from '@prisma/client';
import { paginated } from '../../common/dto/paginated-result.js';
import type { QuoteRowForDto } from '../../common/mappers/quote.mapper.js';
import { normalizeArabic } from '../../common/text/arabic-normalizer.js';
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

  private buildGradeFilter(allowedGrades: HadithGrade[]): Prisma.QuoteWhereInput {
    if (allowedGrades.includes(HadithGrade.UNGRADED)) {
      return {
        OR: [{ grade: { in: allowedGrades } }, { grade: null }],
      };
    }
    return { grade: { in: allowedGrades } };
  }

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
      this.buildGradeFilter(allowedGrades),
    ];

    if (query.collectionId) {
      and.push({ sourceId: query.collectionId });
    }
    if (query.narrator) {
      const narrator = normalizeArabic(query.narrator);
      and.push({
        OR: [
          { narrator: { contains: query.narrator, mode: 'insensitive' } },
          { narratorAr: { contains: narrator, mode: 'insensitive' } },
        ],
      });
    }
    if (query.reference) {
      and.push({
        hadithReference: {
          contains: query.reference,
          mode: 'insensitive',
        },
      });
    }
    if (query.q) {
      const normalized = normalizeArabic(query.q);
      const textFilter: Prisma.QuoteWhereInput[] = [
        { textAr: { contains: normalized, mode: 'insensitive' } },
      ];
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
      and.push({ OR: textFilter });
    }

    const where: Prisma.QuoteWhereInput = { AND: and };

    const [rows, total] = await this.prisma.$transaction([
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
        this.quotes.toQuoteDto(row as QuoteRowForDto, locale),
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
      include: { _count: { select: { quotes: true } } },
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
