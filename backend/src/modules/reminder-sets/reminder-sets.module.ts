import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { QuotesModule } from '../quotes/quotes.module.js';
import { ReminderSetsAdminController } from './reminder-sets.admin.controller.js';
import { ReminderSetsController } from './reminder-sets.controller.js';
import { ReminderSetsService } from './reminder-sets.service.js';

@Module({
  imports: [AuthModule, QuotesModule],
  controllers: [ReminderSetsController, ReminderSetsAdminController],
  providers: [ReminderSetsService],
})
export class ReminderSetsModule {}
