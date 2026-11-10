import { ClassificationService } from './classification.service.js';
import { LinkConcernsQueryDto } from './dto/link-concerns-query.dto.js';
export declare class LinkConcernsAdminController {
    private readonly classification;
    constructor(classification: ClassificationService);
    list(query: LinkConcernsQueryDto): Promise<{
        data: import("./classification.service.js").LinkConcernDto[];
        meta: {
            counts: Record<import("./dto/link-concerns-query.dto.js").LinkKind, number>;
            limitPerKind: number;
        };
    }>;
}
