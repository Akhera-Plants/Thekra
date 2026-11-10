import { LocaleQueryDto } from '../../common/dto/locale-query.dto.js';
import { HomeMomentsService } from './home-moments.service.js';
export declare class HomeMomentsController {
    private readonly service;
    constructor(service: HomeMomentsService);
    findAll(query: LocaleQueryDto): Promise<{
        data: import("./home-moments.service.js").HomeMomentDto[];
        meta: {
            locale: string;
            source: "database" | "seed";
        };
    }>;
}
