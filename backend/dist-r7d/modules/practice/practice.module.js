var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PushModule } from '../push/push.module.js';
import { QuotesModule } from '../quotes/quotes.module.js';
import { CalendarController } from './calendar.controller.js';
import { MePracticeController } from './me-practice.controller.js';
import { PracticeController } from './practice.controller.js';
import { PracticeSyncService } from './practice-sync.service.js';
import { PracticeService } from './practice.service.js';
import { SinVaultController } from './sin-vault.controller.js';
import { SinVaultService } from './sin-vault.service.js';
let PracticeModule = class PracticeModule {
};
PracticeModule = __decorate([
    Module({
        imports: [QuotesModule, AuthModule, PushModule],
        controllers: [PracticeController, CalendarController, MePracticeController, SinVaultController],
        providers: [PracticeService, PracticeSyncService, SinVaultService],
    })
], PracticeModule);
export { PracticeModule };
//# sourceMappingURL=practice.module.js.map