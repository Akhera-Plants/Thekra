import { Body, Controller, Get, Header, Param, ParseUUIDPipe, Patch, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard, Roles, RolesGuard } from '../../common/guards/admin.guard.js';
import { PRIVATE_CACHE_HEADER } from '../../common/http/public-cache.js';
import { CircleFeedService } from './circle-feed.service.js';
import { AdminCircleReportsQueryDto, UpdateCircleReportDto } from './dto/companion.dto.js';

/**
 * Round 7 (D8): reports of a صحبة member or message, for the owner of Thekra. A report never removes anything by itself;
 * the only write is marking it handled (round 8, B5).
 */
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('admin/circle-reports')
export class CircleReportsAdminController {
  constructor(private readonly feed: CircleFeedService) {}

  @Get()
  @Header('Cache-Control', PRIVATE_CACHE_HEADER)
  list(@Query() query: AdminCircleReportsQueryDto) {
    return this.feed.adminReports(query);
  }

  @Patch(':id')
  setStatus(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCircleReportDto) {
    return this.feed.adminSetReportStatus(id, dto.status);
  }
}
