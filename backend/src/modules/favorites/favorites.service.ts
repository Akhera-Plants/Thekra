import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { GradePolicy } from '../hadith/grade-policy.js';
import { paginated } from '../../common/dto/paginated-result.js';
import {
  mapQuoteToDto,
  quoteIncludeForDto,
} from '../../common/mappers/quote.mapper.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { FavoritesQueryDto } from './dto/favorites-query.dto.js';

@Injectable()
export class FavoritesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * #24 GET /favorites — paginated list of saved quotes, newest first.
   */
  async list(userId: string, query: FavoritesQueryDto) {
    const locale = query.lang ?? 'ar';
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.FavoriteWhereInput = {
      userId,
      quote: {
        AND: [
          ...(query.type ? [{ type: query.type }] : []),
          GradePolicy.readerClause(),
        ],
      },
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.favorite.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: { quote: { include: quoteIncludeForDto } },
      }),
      this.prisma.favorite.count({ where }),
    ]);

    const data = rows.map((fav) => ({
      id: fav.id,
      createdAt: fav.createdAt,
      quote: { ...mapQuoteToDto(fav.quote, locale), isFavorite: true },
    }));

    return paginated(data, total, page, limit);
  }

  /**
   * #25 GET /favorites/quote-ids — cheap list of favorited quote UUIDs.
   * Used client-side to mark hearts across any list without per-item calls.
   */
  async listQuoteIds(userId: string): Promise<string[]> {
    const rows = await this.prisma.favorite.findMany({
      where: { userId, quote: GradePolicy.readerClause() },
      select: { quoteId: true },
    });
    return rows.map((r) => r.quoteId);
  }

  /**
   * #26 POST /favorites
   * Returns 409 ALREADY_FAVORITED on duplicate.
   * Returns 422 RELATED_RESOURCE_INVALID if quoteId does not exist.
   */
  async add(
    userId: string,
    quoteId: string,
  ): Promise<{ id: string; quoteId: string; createdAt: Date }> {
    // Verify quote exists first
    const quote = await this.prisma.quote.findUnique({
      where: { id: quoteId },
      select: {
        id: true,
        type: true,
        gradeSource: true,
        textSource: true,
        textVerifiedAt: true,
        flags: { where: { status: 'OPEN', severity: 'HIGH' }, select: { id: true }, take: 1 },
      },
    });
    if (
      !quote
      || !GradePolicy.isPublicText(quote)
      ||       !GradePolicy.isPublishable(quote)
      || quote.flags.length > 0
    ) {
      throw new UnprocessableEntityException({
        code: 'RELATED_RESOURCE_INVALID',
        message: `Quote '${quoteId}' does not exist.`,
      });
    }

    try {
      const fav = await this.prisma.favorite.create({
        data: { userId, quoteId },
        select: { id: true, quoteId: true, createdAt: true },
      });
      return fav;
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException({
          code: 'ALREADY_FAVORITED',
          message: 'This quote is already in your favorites.',
        });
      }
      throw err;
    }
  }

  /**
   * #27 DELETE /favorites/:quoteId
   * Keyed by quoteId (not favorite.id) so the client never needs the join-row id.
   * Returns 404 when not favorited.
   */
  async remove(userId: string, quoteId: string): Promise<void> {
    const result = await this.prisma.favorite.deleteMany({
      where: { userId, quoteId },
    });
    if (result.count === 0) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'Favorite not found.',
      });
    }
  }
}
