import { Controller, Get, Query, StreamableFile } from '@nestjs/common';
import { PUBLIC_CACHE, PublicCache } from '../../common/http/public-cache.js';
import { OccasionsIcsQueryDto } from './dto/occasions-ics-query.dto.js';
import { OccasionsQueryDto } from './dto/occasions-query.dto.js';
import { PracticeService } from './practice.service.js';

@Controller('calendar')
export class CalendarController {
  constructor(private readonly practiceService: PracticeService) {}

  /** Sunnah occasion days between two dates (default: today, UTC, and one year on). */
  @Get('occasions')
  @PublicCache(PUBLIC_CACHE.daily)
  occasions(@Query() query: OccasionsQueryDto) {
    return this.practiceService.occasions(query);
  }

  /**
   * The public calendar feed. Subscribable as webcal://<api>/v1/calendar/occasions.ics; the same file for
   * everyone, so it is CDN-cached. A StreamableFile is sent as is (no JSON envelope).
   */
  @Get('occasions.ics')
  @PublicCache(PUBLIC_CACHE.reference)
  occasionsIcs(@Query() query: OccasionsIcsQueryDto): StreamableFile {
    const lang = query.lang ?? 'ar';
    const body = Buffer.from(this.practiceService.occasionsIcs(lang, query.months), 'utf8');
    return new StreamableFile(body, {
      type: 'text/calendar; charset=utf-8',
      disposition: `inline; filename="thekra-occasions-${lang}.ics"`,
      length: body.length,
    });
  }
}
