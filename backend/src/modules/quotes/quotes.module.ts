import { Module } from '@nestjs/common';
import { QuotesAdminController } from './quotes.admin.controller.js';
import { QuotesController } from './quotes.controller.js';
import { QuotesService } from './quotes.service.js';

@Module({
  controllers: [QuotesController, QuotesAdminController],
  providers: [QuotesService],
  exports: [QuotesService],
})
export class QuotesModule {}
