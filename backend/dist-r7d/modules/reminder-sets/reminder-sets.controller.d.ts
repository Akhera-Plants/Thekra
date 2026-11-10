import { LocaleQueryDto } from '../../common/dto/locale-query.dto.js';
import { ReminderSetsService } from './reminder-sets.service.js';
export declare class ReminderSetsController {
    private readonly service;
    constructor(service: ReminderSetsService);
    findAll(query: LocaleQueryDto): Promise<{
        data: import("./reminder-sets.service.js").ReminderSetDetailDto[];
    }>;
    findOne(slug: string, query: LocaleQueryDto): Promise<{
        data: import("./reminder-sets.service.js").ReminderSetDetailDto;
    }>;
}
