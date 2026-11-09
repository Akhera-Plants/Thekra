import { Module, forwardRef } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { FavoritesModule } from '../favorites/favorites.module.js';
import { QuotesAdminController } from './quotes.admin.controller.js';
import { QuotesController } from './quotes.controller.js';
import { QuoteReaderService } from './quote-reader.service.js';
import { QuoteReportsService } from './quote-reports.service.js';
import { QuotesService } from './quotes.service.js';

@Module({
  imports: [
    AuthModule,
    forwardRef(() => FavoritesModule),
  ],
  controllers: [QuotesController, QuotesAdminController],
  providers: [QuotesService, QuoteReportsService, QuoteReaderService],
  exports: [QuotesService],
})
export class QuotesModule {}
