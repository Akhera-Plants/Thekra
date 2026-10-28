import { Body, Controller, Delete, Header, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { CurrentUser, type JwtPayload } from '../../common/decorators/current-user.decorator.js';
import { PRIVATE_CACHE_HEADER } from '../../common/http/public-cache.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { PushEndpointDto, PushSubscriptionDto, PushTestDto } from './dto/push-subscription.dto.js';
import { PushService } from './push.service.js';

/** The signed-in user's browsers that receive reminders (docs/plan/2026-10-web-push.md §3). */
@Controller('me/push')
@UseGuards(JwtAuthGuard)
export class MePushController {
  constructor(private readonly push: PushService) {}

  /** Adds or refreshes this browser (call again when the time zone or language changes); plans its reminders. */
  @Post('subscriptions')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', PRIVATE_CACHE_HEADER)
  subscribe(@CurrentUser() user: JwtPayload, @Body() dto: PushSubscriptionDto) {
    return this.push.subscribe(user.sub, dto);
  }

  @Delete('subscriptions')
  @HttpCode(HttpStatus.NO_CONTENT)
  async unsubscribe(@CurrentUser() user: JwtPayload, @Body() dto: PushEndpointDto): Promise<void> {
    await this.push.unsubscribe(user.sub, dto.endpoint);
  }

  @Post('test')
  @HttpCode(HttpStatus.NO_CONTENT)
  async test(@CurrentUser() user: JwtPayload, @Body() dto: PushTestDto): Promise<void> {
    await this.push.sendTest(user.sub, dto.endpoint, dto.locale);
  }
}
