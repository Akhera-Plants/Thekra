import { SourceType } from '@prisma/client';
export declare class CreateSourceDto {
    name: string;
    nameAr?: string;
    type: SourceType;
    author?: string;
    authorAr?: string;
    language?: string;
    isExternalApi?: boolean;
    apiProvider?: string;
    apiBaseUrl?: string;
}
