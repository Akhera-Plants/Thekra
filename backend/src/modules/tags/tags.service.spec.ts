import { Test } from '@nestjs/testing';
import { TagCategory } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { TagsService } from './tags.service.js';

describe('TagsService', () => {
  let service: TagsService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [TagsService, { provide: PrismaService, useValue: {} }],
    }).compile();
    service = module.get(TagsService);
  });

  describe('toTagDto', () => {
    it('maps tag row and quote count', () => {
      const dto = service.toTagDto({
        id: 'tag-1',
        name: 'Sincerity',
        nameAr: 'الإخلاص',
        slug: 'sincerity',
        category: TagCategory.THEME,
        _count: { quotes: 3 },
      });
      expect(dto).toEqual({
        id: 'tag-1',
        name: 'Sincerity',
        nameAr: 'الإخلاص',
        slug: 'sincerity',
        category: TagCategory.THEME,
        quoteCount: 3,
      });
    });
  });
});
