var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
import { Controller, Get, Query, StreamableFile } from '@nestjs/common';
import { PUBLIC_CACHE, PublicCache } from '../../common/http/public-cache.js';
import { OccasionsIcsQueryDto } from './dto/occasions-ics-query.dto.js';
import { OccasionsQueryDto } from './dto/occasions-query.dto.js';
import { PracticeService } from './practice.service.js';
let CalendarController = class CalendarController {
    practiceService;
    constructor(practiceService) {
        this.practiceService = practiceService;
    }
    occasions(query) {
        return this.practiceService.occasions(query);
    }
    occasionsIcs(query) {
        const lang = query.lang ?? 'ar';
        const body = Buffer.from(this.practiceService.occasionsIcs(lang, query.months), 'utf8');
        return new StreamableFile(body, {
            type: 'text/calendar; charset=utf-8',
            disposition: `inline; filename="thekra-occasions-${lang}.ics"`,
            length: body.length,
        });
    }
};
__decorate([
    Get('occasions'),
    PublicCache(PUBLIC_CACHE.daily),
    __param(0, Query()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [OccasionsQueryDto]),
    __metadata("design:returntype", void 0)
], CalendarController.prototype, "occasions", null);
__decorate([
    Get('occasions.ics'),
    PublicCache(PUBLIC_CACHE.reference),
    __param(0, Query()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [OccasionsIcsQueryDto]),
    __metadata("design:returntype", StreamableFile)
], CalendarController.prototype, "occasionsIcs", null);
CalendarController = __decorate([
    Controller('calendar'),
    __metadata("design:paramtypes", [PracticeService])
], CalendarController);
export { CalendarController };
//# sourceMappingURL=calendar.controller.js.map