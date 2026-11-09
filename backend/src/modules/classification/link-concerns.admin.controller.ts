import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard, Roles, RolesGuard } from '../../common/guards/admin.guard.js';
import { ClassificationService } from './classification.service.js';
import { LinkConcernsQueryDto } from './dto/link-concerns-query.dto.js';

/**
 * The owner's review list (round 6, C-01n): topic↔text links flagged «no real link» while linking. Set or clear a
 * concern with PATCH /admin/{sin,good-deed,branch}-quotes/:id { concern, concernNote }.
 */
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('admin/link-concerns')
export class LinkConcernsAdminController {
  constructor(private readonly classification: ClassificationService) {}

  @Get()
  list(@Query() query: LinkConcernsQueryDto) {
    return this.classification.listLinkConcerns(query);
  }
}
