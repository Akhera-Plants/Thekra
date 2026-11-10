import { ChapterMapTarget } from '@prisma/client';
export declare class CreateChapterMapDto {
    sourceId: string;
    chapterKey: string;
    chapterTitleAr: string;
    targetType: ChapterMapTarget;
    sinId?: string;
    goodDeedId?: string;
    imanBranchId?: string;
    reviewed?: boolean;
}
