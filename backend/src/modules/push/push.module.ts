import { Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MePushController } from './me-push.controller.js';
import { PushController } from './push.controller.js';
import { PUSH_CONFIG } from './push.constants.js';
import { PUSH_VARIABLES, readPushConfig, type PushConfig } from './push-config.js';
import { PushService } from './push.service.js';
import {
  DeliveryVerifier,
  PushScheduler,
  PushSender,
  QstashScheduler,
  QstashVerifier,
  WebPushSender,
} from './push-transport.js';

/**
 * Web push reminders (docs/plan/2026-10-web-push.md). Off unless every push variable is set; the outside
 * services (QStash, the browsers' push services) sit behind PushScheduler / DeliveryVerifier / PushSender.
 *
 * It does not import AuthModule: AuthModule imports this module (account deletion cancels the schedule), and
 * JwtAuthGuard needs nothing from AuthModule's providers (the passport strategy is registered app-wide).
 */
@Module({
  controllers: [PushController, MePushController],
  providers: [
    {
      provide: PUSH_CONFIG,
      inject: [ConfigService],
      useFactory: (config: ConfigService): PushConfig => {
        const push = readPushConfig(config);
        if (!push.enabled && push.missing.length < PUSH_VARIABLES.length) {
          new Logger('PushModule').warn(`Web push is off; missing: ${push.missing.join(', ')}`);
        }
        return push;
      },
    },
    { provide: PushScheduler, inject: [PUSH_CONFIG], useFactory: (c: PushConfig) => new QstashScheduler(c) },
    { provide: DeliveryVerifier, inject: [PUSH_CONFIG], useFactory: (c: PushConfig) => new QstashVerifier(c) },
    { provide: PushSender, inject: [PUSH_CONFIG], useFactory: (c: PushConfig) => new WebPushSender(c) },
    PushService,
  ],
  exports: [PushService],
})
export class PushModule {}
