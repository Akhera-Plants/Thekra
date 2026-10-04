import { Module } from '@nestjs/common';
import { HadithModule } from '../hadith/hadith.module.js';
import { QuotesModule } from '../quotes/quotes.module.js';
import { GoodDeedsController } from './good-deeds.controller.js';
import { GoodDeedsService } from './good-deeds.service.js';

@Module({
  imports: [QuotesModule, HadithModule],
  controllers: [GoodDeedsController],
  providers: [GoodDeedsService],
  exports: [GoodDeedsService],
})
export class GoodDeedsModule {}
