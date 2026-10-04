import { Module } from '@nestjs/common';
import { GradePolicy } from './grade-policy.js';

@Module({
  providers: [GradePolicy],
  exports: [GradePolicy],
})
export class HadithModule {}
