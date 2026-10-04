import { Module } from '@nestjs/common';
import { QuotesModule } from '../quotes/quotes.module.js';
import { QuranController } from './quran.controller.js';
import { QuranService } from './quran.service.js';

@Module({
  imports: [QuotesModule],
  controllers: [QuranController],
  providers: [QuranService],
  exports: [QuranService],
})
export class QuranModule {}
