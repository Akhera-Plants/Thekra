import { Body, Controller, Get, Header, HttpCode, HttpStatus, Put, UseGuards } from '@nestjs/common';
import { CurrentUser, type JwtPayload } from '../../common/decorators/current-user.decorator.js';
import { PRIVATE_CACHE_HEADER } from '../../common/http/public-cache.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { PutPracticeStoreDto } from './dto/put-practice-store.dto.js';
import { PracticeStoreService } from './practice-store.service.js';

/** The signed-in user's synced practice store (never sin programs, roadmap §0.1). Never CDN-cached. */
@Controller('me/practice')
@UseGuards(JwtAuthGuard)
export class MePracticeController {
  constructor(private readonly practiceStore: PracticeStoreService) {}

  @Get()
  @Header('Cache-Control', PRIVATE_CACHE_HEADER)
  find(@CurrentUser() user: JwtPayload) {
    return this.practiceStore.find(user.sub);
  }

  @Put()
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', PRIVATE_CACHE_HEADER)
  save(@CurrentUser() user: JwtPayload, @Body() dto: PutPracticeStoreDto) {
    return this.practiceStore.save(user.sub, dto);
  }
}
