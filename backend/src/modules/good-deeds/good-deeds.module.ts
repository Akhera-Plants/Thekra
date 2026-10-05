import { Module } from '@nestjs/common';
import { QuotesModule } from '../quotes/quotes.module.js';
import { FavoritesModule } from '../favorites/favorites.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { GoodDeedsAdminController } from './good-deeds.admin.controller.js';
import { GoodDeedsController } from './good-deeds.controller.js';
import { GoodDeedsService } from './good-deeds.service.js';

@Module({
  imports: [QuotesModule, FavoritesModule, AuthModule],
  controllers: [GoodDeedsController, GoodDeedsAdminController],
  providers: [GoodDeedsService],
  exports: [GoodDeedsService],
})
export class GoodDeedsModule {}
