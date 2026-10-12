import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { FavoritesModule } from '../favorites/favorites.module.js';
import { HadithModule } from '../hadith/hadith.module.js';
import { QuotesModule } from '../quotes/quotes.module.js';
import { ImanBranchesAdminController } from './iman-branches.admin.controller.js';
import { ImanBranchesController } from './iman-branches.controller.js';
import { ImanBranchesService } from './iman-branches.service.js';

@Module({
  imports: [QuotesModule, HadithModule, FavoritesModule, AuthModule],
  controllers: [ImanBranchesController, ImanBranchesAdminController],
  providers: [ImanBranchesService],
  exports: [ImanBranchesService],
})
export class ImanBranchesModule {}
