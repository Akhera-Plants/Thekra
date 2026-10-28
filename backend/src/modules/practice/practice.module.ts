import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { QuotesModule } from '../quotes/quotes.module.js';
import { CalendarController } from './calendar.controller.js';
import { MePracticeController } from './me-practice.controller.js';
import { PracticeController } from './practice.controller.js';
import { PracticeStoreService } from './practice-store.service.js';
import { PracticeService } from './practice.service.js';

/**
 * Reminders, habit plans and the calendar (roadmap §2–§4, §8): the public catalog and occasion calendar,
 * and the account copy of the practice store. The catalog lookups used by good-deeds and sins are plain
 * functions in practice-catalog.ts, so those modules do not import this one.
 */
@Module({
  imports: [QuotesModule, AuthModule],
  controllers: [PracticeController, CalendarController, MePracticeController],
  providers: [PracticeService, PracticeStoreService],
})
export class PracticeModule {}
