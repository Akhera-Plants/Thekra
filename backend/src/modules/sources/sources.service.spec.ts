import { Test } from '@nestjs/testing';
import { SourceType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { SourcesService } from './sources.service.js';

describe('SourcesService', () => {
  let service: SourcesService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [SourcesService, { provide: PrismaService, useValue: {} }],
    }).compile();
    service = module.get(SourcesService);
  });

  describe('toSourceDto', () => {
    it('maps source row and quote count', () => {
      const synced = new Date('2025-06-01T00:00:00.000Z');
      const dto = service.toSourceDto({
        id: 'src-1',
        name: 'Bukhari',
        nameAr: 'البخاري',
        type: SourceType.HADITH_COLLECTION,
        author: 'Imam Bukhari',
        authorAr: null,
        language: 'ar',
        isExternalApi: false,
        apiProvider: null,
        apiBaseUrl: null,
        lastSyncedAt: synced,
        _count: { quotes: 10 },
      });
      expect(dto).toEqual({
        id: 'src-1',
        name: 'Bukhari',
        nameAr: 'البخاري',
        type: SourceType.HADITH_COLLECTION,
        author: 'Imam Bukhari',
        authorAr: null,
        language: 'ar',
        isExternalApi: false,
        apiProvider: null,
        apiBaseUrl: null,
        lastSyncedAt: synced,
        quoteCount: 10,
      });
    });
  });
});
