var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { ConflictException, Injectable, NotFoundException, UnprocessableEntityException, } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { GradePolicy } from '../hadith/grade-policy.js';
import { paginated } from '../../common/dto/paginated-result.js';
import { mapQuoteToDto, quoteIncludeForDto, } from '../../common/mappers/quote.mapper.js';
import { PrismaService } from '../../prisma/prisma.service.js';
let FavoritesService = class FavoritesService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async list(userId, query) {
        const locale = query.lang ?? 'ar';
        const page = query.page ?? 1;
        const limit = query.limit ?? 20;
        const skip = (page - 1) * limit;
        const where = {
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
    async listQuoteIds(userId) {
        const rows = await this.prisma.favorite.findMany({
            where: { userId, quote: GradePolicy.readerClause() },
            select: { quoteId: true },
        });
        return rows.map((r) => r.quoteId);
    }
    async add(userId, quoteId) {
        const quote = await this.prisma.quote.findUnique({
            where: { id: quoteId },
            select: {
                id: true,
                type: true,
                gradeSource: true,
                isAthar: true,
                atharSpeakerKey: true,
                atharReviewDecision: true,
                textSource: true,
                textVerifiedAt: true,
                flags: { where: { status: 'OPEN', severity: 'HIGH' }, select: { id: true }, take: 1 },
            },
        });
        if (!quote
            || !GradePolicy.isPublicText(quote)
            || !GradePolicy.isPublishable(quote)
            || quote.flags.length > 0) {
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
        }
        catch (err) {
            if (err instanceof Prisma.PrismaClientKnownRequestError &&
                err.code === 'P2002') {
                throw new ConflictException({
                    code: 'ALREADY_FAVORITED',
                    message: 'This quote is already in your favorites.',
                });
            }
            throw err;
        }
    }
    async remove(userId, quoteId) {
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
};
FavoritesService = __decorate([
    Injectable(),
    __metadata("design:paramtypes", [PrismaService])
], FavoritesService);
export { FavoritesService };
//# sourceMappingURL=favorites.service.js.map