import { Module } from '@nestjs/common';
import { QuotesModule } from '../quotes/quotes.module.js';
import { GoodDeedsAdminController } from './good-deeds.admin.controller.js';
import { GoodDeedsController } from './good-deeds.controller.js';
import { GoodDeedsService } from './good-deeds.service.js';

@Module({
  imports: [QuotesModule],
  controllers: [GoodDeedsController, GoodDeedsAdminController],
  providers: [GoodDeedsService],
  exports: [GoodDeedsService],
})
export class GoodDeedsModule {}
