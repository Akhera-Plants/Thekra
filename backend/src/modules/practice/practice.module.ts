import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { QuotesModule } from '../quotes/quotes.module.js';
import { CalendarController } from './calendar.controller.js';
import { MePracticeController } from './me-practice.controller.js';
import { PracticeController } from './practice.controller.js';
import { PracticeSyncService } from './practice-sync.service.js';
import { PracticeService } from './practice.service.js';
import { SinVaultController } from './sin-vault.controller.js';
import { SinVaultService } from './sin-vault.service.js';

/**
 * Reminders, habit plans and the calendar (roadmap §2–§4, §8): the public catalog and occasion calendar,
 * practice sync (settings, plans, logs, relatives, contacts) and the encrypted sin vault. The catalog
 * lookups used by good-deeds and sins are plain functions in practice-catalog.ts, so those modules do not
 * import this one.
 */
@Module({
  imports: [QuotesModule, AuthModule],
  controllers: [PracticeController, CalendarController, MePracticeController, SinVaultController],
  providers: [PracticeService, PracticeSyncService, SinVaultService],
})
export class PracticeModule {}
