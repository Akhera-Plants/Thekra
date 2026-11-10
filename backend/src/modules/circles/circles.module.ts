import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { CircleReportsAdminController } from './circle-reports.admin.controller.js';
import { CirclesController } from './circles.controller.js';
import { CircleFeedService } from './circle-feed.service.js';
import { CircleInvitesService } from './circle-invites.service.js';
import { CirclesService } from './circles.service.js';

/**
 * صحبة: private, invite-only companion circles (owner decision 2026-10-29, roadmap §0.5; round 6 C-01k invites;
 * round 7 feed, rounds, reports).
 */
@Module({
  imports: [AuthModule],
  controllers: [CirclesController, CircleReportsAdminController],
  providers: [CirclesService, CircleInvitesService, CircleFeedService],
})
export class CirclesModule {}
