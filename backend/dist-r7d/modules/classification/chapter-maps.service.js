var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { BadRequestException, Injectable, NotFoundException, UnprocessableEntityException, } from '@nestjs/common';
import { ChapterMapTarget, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
let ChapterMapsService = class ChapterMapsService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async create(dto) {
        this.assertTarget(dto);
        await this.assertRefs(dto);
        const row = await this.prisma.chapterEntityMap.create({ data: dto });
        return { data: row };
    }
    async list(sourceId) {
        const rows = await this.prisma.chapterEntityMap.findMany({
            where: sourceId ? { sourceId } : undefined,
            orderBy: [{ sourceId: 'asc' }, { chapterKey: 'asc' }],
        });
        return { data: rows };
    }
    async updateReviewed(id, reviewed) {
        try {
            const row = await this.prisma.chapterEntityMap.update({
                where: { id },
                data: { reviewed },
            });
            return { data: row };
        }
        catch (error) {
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
                throw new NotFoundException({ code: 'RESOURCE_NOT_FOUND', message: 'Chapter map not found' });
            }
            throw error;
        }
    }
    async remove(id) {
        try {
            await this.prisma.chapterEntityMap.delete({ where: { id } });
        }
        catch (error) {
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
                throw new NotFoundException({ code: 'RESOURCE_NOT_FOUND', message: 'Chapter map not found' });
            }
            throw error;
        }
    }
    assertTarget(dto) {
        const ids = [dto.sinId, dto.goodDeedId, dto.imanBranchId].filter(Boolean);
        const matches = (dto.targetType === ChapterMapTarget.SIN && dto.sinId && !dto.goodDeedId && !dto.imanBranchId) ||
            (dto.targetType === ChapterMapTarget.GOOD_DEED && dto.goodDeedId && !dto.sinId && !dto.imanBranchId) ||
            (dto.targetType === ChapterMapTarget.IMAN_BRANCH && dto.imanBranchId && !dto.sinId && !dto.goodDeedId);
        if (!matches || ids.length !== 1) {
            throw new BadRequestException({
                code: 'VALIDATION_FAILED',
                message: 'Exactly one target id must match targetType',
            });
        }
    }
    async assertRefs(dto) {
        const source = await this.prisma.source.findUnique({ where: { id: dto.sourceId } });
        if (!source) {
            throw new UnprocessableEntityException({
                code: 'RELATED_RESOURCE_INVALID',
                message: 'Source not found',
            });
        }
        if (dto.sinId && !(await this.prisma.sin.findUnique({ where: { id: dto.sinId } }))) {
            throw new UnprocessableEntityException({
                code: 'RELATED_RESOURCE_INVALID',
                message: 'Sin not found',
            });
        }
        if (dto.goodDeedId && !(await this.prisma.goodDeed.findUnique({ where: { id: dto.goodDeedId } }))) {
            throw new UnprocessableEntityException({
                code: 'RELATED_RESOURCE_INVALID',
                message: 'Good deed not found',
            });
        }
        if (dto.imanBranchId && !(await this.prisma.imanBranch.findUnique({ where: { id: dto.imanBranchId } }))) {
            throw new UnprocessableEntityException({
                code: 'RELATED_RESOURCE_INVALID',
                message: 'Branch not found',
            });
        }
    }
};
ChapterMapsService = __decorate([
    Injectable(),
    __metadata("design:paramtypes", [PrismaService])
], ChapterMapsService);
export { ChapterMapsService };
//# sourceMappingURL=chapter-maps.service.js.map