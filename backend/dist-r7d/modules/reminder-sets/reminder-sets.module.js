var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { QuotesModule } from '../quotes/quotes.module.js';
import { ReminderSetsAdminController } from './reminder-sets.admin.controller.js';
import { ReminderSetsController } from './reminder-sets.controller.js';
import { ReminderSetsService } from './reminder-sets.service.js';
let ReminderSetsModule = class ReminderSetsModule {
};
ReminderSetsModule = __decorate([
    Module({
        imports: [AuthModule, QuotesModule],
        controllers: [ReminderSetsController, ReminderSetsAdminController],
        providers: [ReminderSetsService],
    })
], ReminderSetsModule);
export { ReminderSetsModule };
//# sourceMappingURL=reminder-sets.module.js.map