import { Module } from '@nestjs/common';
import { QuotesModule } from '../quotes/quotes.module.js';
import { HadithController } from './hadith.controller.js';
import { HadithService } from './hadith.service.js';

@Module({
  imports: [QuotesModule],
  controllers: [HadithController],
  providers: [HadithService],
  exports: [HadithService],
})
export class HadithModule {}
