import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { HomeMomentsAdminController } from './home-moments.admin.controller.js';
import { HomeMomentsController } from './home-moments.controller.js';
import { HomeMomentsService } from './home-moments.service.js';

/** Home «في لحظات مثل هذه», controlled from the backend (round 6, C-09). */
@Module({
  imports: [AuthModule],
  controllers: [HomeMomentsController, HomeMomentsAdminController],
  providers: [HomeMomentsService],
})
export class HomeMomentsModule {}
