import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser, type JwtPayload } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { JwtAuthGuard, RolesGuard } from '../../common/guards/admin.guard.js';
import { ReviewFlagsQueryDto } from './dto/review-flags-query.dto.js';
import { ReviewNoteDto } from './dto/review-note.dto.js';
import { ReviewService } from './review.service.js';

@Controller('review')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'REVIEWER')
export class ReviewController {
  constructor(private readonly review: ReviewService) {}

  @Get('flags')
  listFlags(@Query() query: ReviewFlagsQueryDto) {
    return this.review.listFlags(query);
  }

  @Get('flags/:id')
  getFlag(@Param('id', ParseUUIDPipe) id: string) {
    return this.review.getFlag(id);
  }

  @Post('matches/:id/confirm')
  @HttpCode(HttpStatus.OK)
  confirmMatch(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReviewNoteDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.review.confirmMatch(id, user.sub, dto.note);
  }

  @Post('matches/:id/reject')
  @HttpCode(HttpStatus.OK)
  rejectMatch(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReviewNoteDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.review.rejectMatch(id, user.sub, dto.note);
  }

  @Post('flags/:id/resolve')
  @HttpCode(HttpStatus.OK)
  resolve(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReviewNoteDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.review.closeFlag(id, user.sub, 'RESOLVED', dto.note);
  }

  @Post('flags/:id/dismiss')
  @HttpCode(HttpStatus.OK)
  dismiss(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReviewNoteDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.review.closeFlag(id, user.sub, 'DISMISSED', dto.note);
  }
}
