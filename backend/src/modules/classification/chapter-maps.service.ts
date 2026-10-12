import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ChapterMapTarget, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { CreateChapterMapDto } from './dto/create-chapter-map.dto.js';

/**
 * One reviewed row means: narrations in this chapter of this book
 * may be linked as ACCEPTED, with chapterTitleAr stored as the link note.
 * Unreviewed rows are the owner's queue. This service does not invent links.
 */
@Injectable()
export class ChapterMapsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateChapterMapDto) {
    this.assertTarget(dto);
    await this.assertRefs(dto);
    const row = await this.prisma.chapterEntityMap.create({ data: dto });
    return { data: row };
  }

  async list(sourceId?: string) {
    const rows = await this.prisma.chapterEntityMap.findMany({
      where: sourceId ? { sourceId } : undefined,
      orderBy: [{ sourceId: 'asc' }, { chapterKey: 'asc' }],
    });
    return { data: rows };
  }

  async updateReviewed(id: string, reviewed: boolean) {
    try {
      const row = await this.prisma.chapterEntityMap.update({
        where: { id },
        data: { reviewed },
      });
      return { data: row };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new NotFoundException({ code: 'RESOURCE_NOT_FOUND', message: 'Chapter map not found' });
      }
      throw error;
    }
  }

  async remove(id: string): Promise<void> {
    try {
      await this.prisma.chapterEntityMap.delete({ where: { id } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new NotFoundException({ code: 'RESOURCE_NOT_FOUND', message: 'Chapter map not found' });
      }
      throw error;
    }
  }

  private assertTarget(dto: CreateChapterMapDto): void {
    const ids = [dto.sinId, dto.goodDeedId, dto.imanBranchId].filter(Boolean);
    const matches =
      (dto.targetType === ChapterMapTarget.SIN && dto.sinId && !dto.goodDeedId && !dto.imanBranchId) ||
      (dto.targetType === ChapterMapTarget.GOOD_DEED && dto.goodDeedId && !dto.sinId && !dto.imanBranchId) ||
      (dto.targetType === ChapterMapTarget.IMAN_BRANCH && dto.imanBranchId && !dto.sinId && !dto.goodDeedId);
    if (!matches || ids.length !== 1) {
      throw new BadRequestException({
        code: 'VALIDATION_FAILED',
        message: 'Exactly one target id must match targetType',
      });
    }
  }

  private async assertRefs(dto: CreateChapterMapDto): Promise<void> {
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
}
