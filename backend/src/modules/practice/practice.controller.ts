import { Controller, Get, Query } from '@nestjs/common';
import { PUBLIC_CACHE, PublicCache } from '../../common/http/public-cache.js';
import { PracticeEvidenceQueryDto } from './dto/practice-evidence-query.dto.js';
import { PracticeService } from './practice.service.js';

@Controller('practice')
export class PracticeController {
  constructor(private readonly practiceService: PracticeService) {}

  /** The reviewed catalog: occasions, habit units, sin programs and tazkiya prompts (deed-schedules.yaml, sin-programs.yaml, tazkiya-prompts.yaml). */
  @Get('catalog')
  @PublicCache(PUBLIC_CACHE.reference)
  catalog() {
    return this.practiceService.catalog();
  }

  /** Published texts for catalog evidence ids; unknown or unpublished ids are left out. */
  @Get('evidence')
  @PublicCache(PUBLIC_CACHE.quote)
  evidence(@Query() query: PracticeEvidenceQueryDto) {
    return this.practiceService.evidence(query.ids, query.lang ?? 'ar');
  }
}
