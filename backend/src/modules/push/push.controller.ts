import { Body, Controller, Get, Header, Headers, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { PRIVATE_CACHE_HEADER } from '../../common/http/public-cache.js';
import { PushService } from './push.service.js';

/**
 * Public side of web push: the browser reads the VAPID key here; the scheduler delivers reminders here
 * (signed by QStash, body is the sealed reminder as text/plain); Vercel's daily cron tops up the schedule.
 * Delivery and refill skip the IP rate limit: many reminders share a minute and come from the scheduler's IPs.
 */
@Controller('push')
export class PushController {
  constructor(private readonly push: PushService) {}

  @Get('config')
  @Header('Cache-Control', PRIVATE_CACHE_HEADER)
  config() {
    return this.push.publicConfig();
  }

  @Post('deliver')
  @SkipThrottle()
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', PRIVATE_CACHE_HEADER)
  deliver(@Headers('upstash-signature') signature: string | undefined, @Body() body: unknown) {
    return this.push.deliver(signature, body);
  }

  @Get('refill')
  @SkipThrottle()
  @Header('Cache-Control', PRIVATE_CACHE_HEADER)
  refill(@Headers('authorization') authorization: string | undefined) {
    return this.push.refillAll(authorization);
  }
}
