import type { SinRank } from '@prisma/client';
import type { SinCategory } from '@thekra/practice-core';
import type { GoodDeedSummary } from '../../good-deeds/entities/good-deed.entity.js';

export interface SinRankSourceDto {
  id: string;
  name: string;
  nameAr: string | null;
}

export interface TopicPairDto {
  avoid: string;
  do: string;
  titleAr: string;
  titleEn: string;
}

export interface SinDto {
  id: string;
  name: string;
  nameAr: string;
  slug: string;
  category: string | null;
  description: string | null;
  descriptionAr: string | null;
  /** Present on admin responses only. Public JSON omits this field. */
  severity?: number | null;
  rank: SinRank | null;
  rankReference: string | null;
  rankSource: SinRankSourceDto | null;
  domainKey: string | null;
  taxonomyOrder: number | null;
  isContemporary: boolean;
  /** Set when taxonomy.yaml lists this slug under pairs:. */
  pair: TopicPairDto | null;
  quoteCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export type SinDetailDto = SinDto & {
  relatedGoodDeeds: GoodDeedSummary[];
  locale: string;
  isContemporary: boolean;
  branches: { number: number; titleAr: string; title: string | null }[];
  /** Whether sin-programs.yaml has a leaving program for this sin, and its category. */
  program: { available: boolean; category: SinCategory | null };
};
