import { StreamableFile } from '@nestjs/common';
import { OccasionsIcsQueryDto } from './dto/occasions-ics-query.dto.js';
import { OccasionsQueryDto } from './dto/occasions-query.dto.js';
import { PracticeService } from './practice.service.js';
export declare class CalendarController {
    private readonly practiceService;
    constructor(practiceService: PracticeService);
    occasions(query: OccasionsQueryDto): import("./entities/practice.entity.js").OccasionOccurrenceDto[];
    occasionsIcs(query: OccasionsIcsQueryDto): StreamableFile;
}
