import { SinRank } from '@prisma/client';
export declare class CreateSinDto {
    name: string;
    nameAr: string;
    slug: string;
    category?: string;
    description?: string;
    descriptionAr?: string;
    severity?: number;
    rank?: SinRank;
    rankSourceId?: string;
    rankReference?: string;
}
