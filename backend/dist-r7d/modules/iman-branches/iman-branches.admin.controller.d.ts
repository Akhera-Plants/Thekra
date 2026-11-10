import type { Response } from 'express';
import { CreateImanBranchDto } from './dto/create-iman-branch.dto.js';
import { ReplaceBranchPracticesDto } from './dto/replace-practices.dto.js';
import { UpdateImanBranchDto } from './dto/update-iman-branch.dto.js';
import { ImanBranchesService } from './iman-branches.service.js';
export declare class ImanBranchesAdminController {
    private readonly branches;
    constructor(branches: ImanBranchesService);
    create(dto: CreateImanBranchDto, res: Response): Promise<{
        data: {
            id: string;
            number: number;
            titleAr: string;
            title: string | null;
            summaryAr: string | null;
            summary: string | null;
            quoteCount: number;
            source: {
                id: string;
                name: string;
                nameAr: string | null;
            } | null;
            sourceReference: string | null;
        };
    }>;
    update(id: string, dto: UpdateImanBranchDto): Promise<{
        data: {
            id: string;
            number: number;
            titleAr: string;
            title: string | null;
            summaryAr: string | null;
            summary: string | null;
            quoteCount: number;
            source: {
                id: string;
                name: string;
                nameAr: string | null;
            } | null;
            sourceReference: string | null;
        };
    }>;
    remove(id: string): Promise<void>;
    replacePractices(id: string, dto: ReplaceBranchPracticesDto): Promise<{
        data: {
            mizan: import("../quotes/quotes.service.js").MizanDto | null;
            explanations: {
                id: string;
                kind: import("@prisma/client").$Enums.ExplanationKind;
                languageCode: string;
                text: string;
                reference: string | null;
                origin: import("@prisma/client").$Enums.QuoteOrigin;
                source: {
                    id: string;
                    name: string;
                    type: import("@prisma/client").$Enums.SourceType;
                    author: string | null;
                    nameAr: string | null;
                    authorAr: string | null;
                };
            }[];
            goodDeeds: {
                name: string;
                slug: string;
                nameAr: string;
            }[];
            sins: {
                name: string;
                slug: string;
                nameAr: string;
                rank: import("@prisma/client").$Enums.SinRank | null;
            }[];
            prev: {
                number: number;
                title: string | null;
                titleAr: string;
            } | null;
            next: {
                number: number;
                title: string | null;
                titleAr: string;
            } | null;
            id: string;
            number: number;
            titleAr: string;
            title: string | null;
            summaryAr: string | null;
            summary: string | null;
            quoteCount: number;
            source: {
                id: string;
                name: string;
                nameAr: string | null;
            } | null;
            sourceReference: string | null;
        };
    }>;
}
