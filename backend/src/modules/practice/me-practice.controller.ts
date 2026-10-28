import { Body, Controller, Get, Header, HttpCode, HttpStatus, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser, type JwtPayload } from '../../common/decorators/current-user.decorator.js';
import { PRIVATE_CACHE_HEADER } from '../../common/http/public-cache.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { PracticeChangesQueryDto } from './dto/practice-changes-query.dto.js';
import { PracticeSyncService } from './practice-sync.service.js';

/**
 * Practice sync for the signed-in user (docs/plan/2026-10-practice-sync-contract.md §3): settings, habit
 * plans and logs, relatives and contacts. Never CDN-cached; the sin program is not here (see /me/sin-vault).
 */
@Controller('me/practice')
@UseGuards(JwtAuthGuard)
export class MePracticeController {
  constructor(private readonly practiceSync: PracticeSyncService) {}

  @Get()
  @Header('Cache-Control', PRIVATE_CACHE_HEADER)
  changes(@CurrentUser() user: JwtPayload, @Query() query: PracticeChangesQueryDto) {
    return this.practiceSync.changes(user.sub, query.since ? new Date(query.since) : null);
  }

  /**
   * The body is validated by PracticeSyncService, not by a DTO: a `programs` key anywhere must answer
   * PRACTICE_PROGRAMS_NOT_ALLOWED, and item errors carry their index (PRACTICE_INVALID).
   */
  @Post('sync')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', PRIVATE_CACHE_HEADER)
  sync(@CurrentUser() user: JwtPayload, @Body() body: Record<string, unknown>) {
    return this.practiceSync.sync(user.sub, body);
  }
}
