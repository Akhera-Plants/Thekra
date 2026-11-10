import { NamesQueryDto } from './dto/names-query.dto.js';
import { NamesOfAllahService } from './names-of-allah.service.js';
export declare class NamesOfAllahController {
    private readonly names;
    constructor(names: NamesOfAllahService);
    findAll(): {
        data: import("./names-of-allah.service.js").NameListItemDto[];
    };
    findOne(slug: string, query: NamesQueryDto): Promise<{
        data: import("./names-of-allah.service.js").NameDetailDto;
    }>;
}
