import type { SinRank } from '@prisma/client';
import type { SinCategory } from '@thekra/practice-core';
import type { MizanDto } from '../../quotes/quotes.service.js';
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
    severity?: number | null;
    rank: SinRank | null;
    rankReference: string | null;
    rankSource: SinRankSourceDto | null;
    domainKey: string | null;
    taxonomyOrder: number | null;
    isContemporary: boolean;
    pair: TopicPairDto | null;
    quoteCount: number;
    createdAt: Date;
    updatedAt: Date;
}
export type SinDetailDto = SinDto & {
    relatedGoodDeeds: GoodDeedSummary[];
    locale: string;
    isContemporary: boolean;
    branches: {
        number: number;
        titleAr: string;
        title: string | null;
    }[];
    program: {
        available: boolean;
        category: SinCategory | null;
    };
    mizan: MizanDto | null;
};
