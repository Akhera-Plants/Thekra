import type { GoodDeedSummary } from '../../good-deeds/entities/good-deed.entity.js';

export interface SinDto {
  id: string;
  name: string;
  nameAr: string;
  slug: string;
  category: string | null;
  description: string | null;
  descriptionAr: string | null;
  severity: number | null;
  quoteCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export type SinDetailDto = SinDto & {
  relatedGoodDeeds: GoodDeedSummary[];
  locale: string;
};
