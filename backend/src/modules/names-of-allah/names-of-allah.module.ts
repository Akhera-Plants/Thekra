import { Module } from '@nestjs/common';
import { QuotesModule } from '../quotes/quotes.module.js';
import { NamesOfAllahController } from './names-of-allah.controller.js';
import { NamesOfAllahService } from './names-of-allah.service.js';

@Module({
  imports: [QuotesModule],
  controllers: [NamesOfAllahController],
  providers: [NamesOfAllahService],
})
export class NamesOfAllahModule {}
