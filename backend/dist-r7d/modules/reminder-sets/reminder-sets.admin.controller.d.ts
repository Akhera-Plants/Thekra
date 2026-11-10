import type { Response } from 'express';
import { CreateReminderSetDto, SetReminderSetItemsDto, UpdateReminderSetDto } from './dto/reminder-set.dto.js';
import { ReminderSetsService } from './reminder-sets.service.js';
export declare class ReminderSetsAdminController {
    private readonly service;
    constructor(service: ReminderSetsService);
    findAll(): Promise<{
        data: import("./reminder-sets.service.js").AdminReminderSetDto[];
    }>;
    findOne(id: string): Promise<{
        data: import("./reminder-sets.service.js").AdminReminderSetDto & {
            items: import("../quotes/entities/quote.entity.js").QuoteDto[];
        };
    }>;
    create(dto: CreateReminderSetDto, res: Response): Promise<{
        data: import("./reminder-sets.service.js").AdminReminderSetDto;
    }>;
    update(id: string, dto: UpdateReminderSetDto): Promise<{
        data: import("./reminder-sets.service.js").AdminReminderSetDto;
    }>;
    setItems(id: string, dto: SetReminderSetItemsDto): Promise<{
        data: import("./reminder-sets.service.js").AdminReminderSetDto;
    }>;
    remove(id: string): Promise<void>;
}
