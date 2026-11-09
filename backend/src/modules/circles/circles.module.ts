import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { CirclesController } from './circles.controller.js';
import { CircleInvitesService } from './circle-invites.service.js';
import { CirclesService } from './circles.service.js';

/** رفقة: private, invite-only companion circles (owner decision 2026-10-29, roadmap §0.5; round 6 C-01k invites). */
@Module({
  imports: [AuthModule],
  controllers: [CirclesController],
  providers: [CirclesService, CircleInvitesService],
})
export class CirclesModule {}
