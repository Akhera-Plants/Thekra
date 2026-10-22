/**
 * content-sync.admin.controller.ts
 *
 * Admin endpoints for the content-sync pipeline.
 * All routes are behind JwtAuthGuard + RolesGuard (ADMIN).
 *
 * #58  POST  /admin/content-sync/runs   — manual trigger
 * #59  GET   /admin/sync-logs           — list runs
 * #60  GET   /admin/sync-logs/:id       — single run
 */

import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard, Roles, RolesGuard } from '../../common/guards/admin.guard.js';
import { ContentSyncService } from './content-sync.service.js';
import { SyncLogService } from './sync-log.service.js';
import { TriggerSyncDto } from './dto/trigger-sync.dto.js';
import { SyncLogsQueryDto } from './dto/sync-logs-query.dto.js';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('admin')
export class ContentSyncAdminController {
  constructor(
    private readonly contentSyncService: ContentSyncService,
    private readonly syncLogService: SyncLogService,
  ) {}

  /**
   * #58 POST /admin/content-sync/runs
   * Trigger a sync run for a given Source.
   * Returns 202 Accepted with the SyncLog handle — the run is async.
   */
  @Post('content-sync/runs')
  @HttpCode(HttpStatus.ACCEPTED)
  async triggerRun(@Body() dto: TriggerSyncDto) {
    const result = await this.contentSyncService.triggerRun(dto);
    return { data: result };
  }

  /**
   * #59 GET /admin/sync-logs
   * List all sync runs, optionally filtered by source, status, and date range.
   */
  @Get('sync-logs')
  async listRuns(@Query() query: SyncLogsQueryDto) {
    return this.syncLogService.findAll({
      sourceId: query.sourceId,
      status: query.status,
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
      page: query.page,
      limit: query.limit,
    });
  }

  /**
   * #60 GET /admin/sync-logs/:id
   * Get a single sync run by ID.
   */
  @Get('sync-logs/:id')
  async getRun(@Param('id', ParseUUIDPipe) id: string) {
    const log = await this.syncLogService.findById(id);
    if (!log) {
      throw new NotFoundException({ code: 'RESOURCE_NOT_FOUND', message: 'SyncLog not found' });
    }
    return { data: log };
  }
}
