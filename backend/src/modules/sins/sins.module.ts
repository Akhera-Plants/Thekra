import { Module } from '@nestjs/common';
import { GoodDeedsModule } from '../good-deeds/good-deeds.module.js';
import { HadithModule } from '../hadith/hadith.module.js';
import { QuotesModule } from '../quotes/quotes.module.js';
import { SinsAdminController } from './sins.admin.controller.js';
import { SinsController } from './sins.controller.js';
import { SinsService } from './sins.service.js';

@Module({
  imports: [QuotesModule, GoodDeedsModule, HadithModule],
  controllers: [SinsController, SinsAdminController],
  providers: [SinsService],
  exports: [SinsService],
})
export class SinsModule {}
