import { Module } from '@nestjs/common';
import { QuotesModule } from '../quotes/quotes.module.js';
import { GradePolicy } from './grade-policy.js';
import { HadithController } from './hadith.controller.js';
import { HadithService } from './hadith.service.js';

@Module({
  imports: [QuotesModule],
  controllers: [HadithController],
  providers: [GradePolicy, HadithService],
  exports: [GradePolicy, HadithService],
})
export class HadithModule {}
