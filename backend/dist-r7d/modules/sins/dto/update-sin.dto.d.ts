import { SinRank } from '@prisma/client';
export declare class UpdateSinDto {
    name?: string;
    nameAr?: string;
    slug?: string;
    category?: string | null;
    description?: string | null;
    descriptionAr?: string | null;
    severity?: number | null;
    rank?: SinRank | null;
    rankSourceId?: string | null;
    rankReference?: string | null;
}
