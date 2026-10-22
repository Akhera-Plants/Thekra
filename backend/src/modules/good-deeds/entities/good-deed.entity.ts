import type { TopicPairDto } from '../../sins/entities/sin.entity.js';

export interface OppositeSinSummary {
  id: string;
  slug: string;
  name: string;
  nameAr: string;
}

export interface GoodDeedDto {
  id: string;
  name: string;
  nameAr: string;
  slug: string;
  category: string | null;
  description: string | null;
  descriptionAr: string | null;
  reward: string | null;
  rewardAr: string | null;
  oppositeSin: OppositeSinSummary | null;
  domainKey: string | null;
  taxonomyOrder: number | null;
  isContemporary: boolean;
  /** Set when taxonomy.yaml lists this slug under pairs:. */
  pair: TopicPairDto | null;
  quoteCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface GoodDeedSummary {
  id: string;
  slug: string;
  name: string;
  nameAr: string;
  reward: string | null;
  rewardAr: string | null;
}
