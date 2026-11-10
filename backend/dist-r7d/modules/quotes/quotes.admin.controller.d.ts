import type { Response } from 'express';
import { AdminQuotesQueryDto } from './dto/admin-quotes-query.dto.js';
import { CreateQuoteDto } from './dto/create-quote.dto.js';
import { CreateTranslationDto } from './dto/create-translation.dto.js';
import { SetTranslationDto } from './dto/set-translation.dto.js';
import { UpdateQuoteDto } from './dto/update-quote.dto.js';
import { QuotesService } from './quotes.service.js';
declare class SetTagsDto {
    tagIds: string[];
}
export declare class QuotesAdminController {
    private readonly quotesService;
    constructor(quotesService: QuotesService);
    create(dto: CreateQuoteDto, res: Response): Promise<{
        data: import("./entities/quote.entity.js").QuoteDto;
    }>;
    findAll(query: AdminQuotesQueryDto): Promise<import("../../common/dto/paginated-result.js").PaginatedResult<import("./entities/quote.entity.js").QuoteDto>>;
    markTextVerified(id: string): Promise<import("./entities/quote.entity.js").QuoteDto>;
    update(id: string, dto: UpdateQuoteDto): Promise<import("./entities/quote.entity.js").QuoteDto>;
    remove(id: string): Promise<void>;
    upsertTranslation(id: string, languageCode: string, body: SetTranslationDto): Promise<{
        id: string;
        languageCode: string;
        text: string;
    }>;
    createTranslation(id: string, body: CreateTranslationDto, res: Response): Promise<{
        id: string;
        languageCode: string;
        text: string;
    }>;
    deleteTranslation(id: string, languageCode: string): Promise<void>;
    setTags(id: string, body: SetTagsDto): Promise<{
        id: string;
        slug: string;
        name: string;
        nameAr: string | null;
        category: import("@prisma/client").$Enums.TagCategory;
    }[]>;
}
export {};
