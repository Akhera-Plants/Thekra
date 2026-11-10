import { PracticeEvidenceQueryDto } from './dto/practice-evidence-query.dto.js';
import { PracticeService } from './practice.service.js';
export declare class PracticeController {
    private readonly practiceService;
    constructor(practiceService: PracticeService);
    catalog(): import("./practice-catalog.js").PracticeCatalog;
    evidence(query: PracticeEvidenceQueryDto): Promise<import("../quotes/entities/quote.entity.js").QuoteDto[]>;
}
