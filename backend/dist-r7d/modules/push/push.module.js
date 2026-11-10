var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MePushController } from './me-push.controller.js';
import { PushController } from './push.controller.js';
import { PUSH_CONFIG } from './push.constants.js';
import { PUSH_VARIABLES, readPushConfig } from './push-config.js';
import { PushService } from './push.service.js';
import { DeliveryVerifier, PushScheduler, PushSender, QstashScheduler, QstashVerifier, WebPushSender, } from './push-transport.js';
let PushModule = class PushModule {
};
PushModule = __decorate([
    Module({
        controllers: [PushController, MePushController],
        providers: [
            {
                provide: PUSH_CONFIG,
                inject: [ConfigService],
                useFactory: (config) => {
                    const push = readPushConfig(config);
                    if (!push.enabled && push.missing.length < PUSH_VARIABLES.length) {
                        new Logger('PushModule').warn(`Web push is off; missing: ${push.missing.join(', ')}`);
                    }
                    return push;
                },
            },
            { provide: PushScheduler, inject: [PUSH_CONFIG], useFactory: (c) => new QstashScheduler(c) },
            { provide: DeliveryVerifier, inject: [PUSH_CONFIG], useFactory: (c) => new QstashVerifier(c) },
            { provide: PushSender, inject: [PUSH_CONFIG], useFactory: (c) => new WebPushSender(c) },
            PushService,
        ],
        exports: [PushService],
    })
], PushModule);
export { PushModule };
//# sourceMappingURL=push.module.js.map