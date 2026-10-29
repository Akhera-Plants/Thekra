import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { CurrentUser, type JwtPayload } from '../../common/decorators/current-user.decorator.js';
import { PRIVATE_CACHE_HEADER } from '../../common/http/public-cache.js';
import { setCreated } from '../../common/http/set-created.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CirclesService } from './circles.service.js';
import { CircleQueryDto } from './dto/circle-query.dto.js';
import { CreateCircleDto } from './dto/create-circle.dto.js';
import { JoinCircleDto } from './dto/join-circle.dto.js';
import { PresenceDto } from './dto/presence.dto.js';
import { SendCheerDto } from './dto/send-cheer.dto.js';
import { UpdateMembershipDto } from './dto/update-membership.dto.js';

/** Guessing invite codes: 5 tries a minute per client, on top of the code's own size. */
const JOIN_THROTTLE = { default: { limit: 5, ttl: 60_000 } };

/** رفقة: private circles of the signed-in user. Never CDN-cached. */
@Controller('circles')
@UseGuards(JwtAuthGuard)
export class CirclesController {
  constructor(private readonly circles: CirclesService) {}

  @Get()
  @Header('Cache-Control', PRIVATE_CACHE_HEADER)
  list(@CurrentUser() user: JwtPayload) {
    return this.circles.listMine(user.sub);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@CurrentUser() user: JwtPayload, @Body() dto: CreateCircleDto, @Res({ passthrough: true }) res: Response) {
    const circle = await this.circles.create(user.sub, dto);
    setCreated(res, `/v1/circles/${circle.id}`);
    return circle;
  }

  @Post('join')
  @HttpCode(HttpStatus.OK)
  @Throttle(JOIN_THROTTLE)
  join(@CurrentUser() user: JwtPayload, @Body() dto: JoinCircleDto) {
    return this.circles.join(user.sub, dto);
  }

  @Put('presence')
  @HttpCode(HttpStatus.OK)
  markPresence(@CurrentUser() user: JwtPayload, @Body() dto: PresenceDto) {
    return this.circles.markPresence(user.sub, dto.date);
  }

  @Delete('presence/:date')
  @HttpCode(HttpStatus.NO_CONTENT)
  async clearPresence(@CurrentUser() user: JwtPayload, @Param('date') date: string): Promise<void> {
    await this.circles.clearPresence(user.sub, date);
  }

  @Get(':id')
  @Header('Cache-Control', PRIVATE_CACHE_HEADER)
  findOne(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string, @Query() query: CircleQueryDto) {
    return this.circles.findOne(user.sub, id, query.today);
  }

  @Patch(':id/membership')
  updateMembership(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateMembershipDto) {
    return this.circles.updateMembership(user.sub, id, dto);
  }

  @Delete(':id/membership')
  @HttpCode(HttpStatus.NO_CONTENT)
  async leave(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.circles.leave(user.sub, id);
  }

  @Post(':id/cheers')
  @HttpCode(HttpStatus.CREATED)
  sendCheer(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string, @Body() dto: SendCheerDto) {
    return this.circles.sendCheer(user.sub, id, dto);
  }

  @Delete(':id/members/:memberId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeMember(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
  ): Promise<void> {
    await this.circles.removeMember(user.sub, id, memberId);
  }

  @Post(':id/invite-code')
  @HttpCode(HttpStatus.OK)
  rotateInviteCode(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.circles.rotateInviteCode(user.sub, id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.circles.deleteCircle(user.sub, id);
  }
}
