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
import { CircleInvitesService } from './circle-invites.service.js';
import { CirclesService } from './circles.service.js';
import { CreateCircleInviteDto } from './dto/create-circle-invite.dto.js';
import { RedeemCircleInviteDto } from './dto/redeem-circle-invite.dto.js';
import { CircleQueryDto } from './dto/circle-query.dto.js';
import { CreateCircleDto } from './dto/create-circle.dto.js';
import { PresenceDto } from './dto/presence.dto.js';
import { CircleFeedService } from './circle-feed.service.js';
import { EndRoundDto, MessagesQueryDto, ReplyRoundDto, ReportDto, SendMessageDto, StartRoundDto } from './dto/companion.dto.js';
import { UpdateMembershipDto } from './dto/update-membership.dto.js';

/** Guessing invite codes: 5 tries a minute per client, on top of the code's own size. */
const JOIN_THROTTLE = { default: { limit: 5, ttl: 60_000 } };
/** Round 7: per-instance bursts; the daily limits live in the database (CircleFeedService FEED_LIMITS). */
const MESSAGE_THROTTLE = { default: { limit: 20, ttl: 60_000 } };
const ROUND_THROTTLE = { default: { limit: 10, ttl: 60_000 } };
const REPORT_THROTTLE = { default: { limit: 5, ttl: 60_000 } };

/**
 * صحبة: private circles of the signed-in user. Never CDN-cached. Invite-only (round 6, C-01k): creating or joining a
 * circle needs صحبة to be on, which a member's personal invite does (`/circles/invites/*`). Round 7: the feed,
 * rounds, suggested lines, «احتفظ بها», reports and hiding a member (CircleFeedService).
 * The fixed paths stay above `:id`, which would otherwise catch them.
 */
@Controller('circles')
@UseGuards(JwtAuthGuard)
export class CirclesController {
  constructor(
    private readonly circles: CirclesService,
    private readonly invites: CircleInvitesService,
    private readonly feed: CircleFeedService,
  ) {}

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

  @Get('access')
  @Header('Cache-Control', PRIVATE_CACHE_HEADER)
  access(@CurrentUser() user: JwtPayload) {
    return this.invites.access(user.sub);
  }

  @Get('invites')
  @Header('Cache-Control', PRIVATE_CACHE_HEADER)
  listInvites(@CurrentUser() user: JwtPayload) {
    return this.invites.list(user.sub);
  }

  @Post('invites')
  @HttpCode(HttpStatus.CREATED)
  @Throttle(JOIN_THROTTLE)
  async createInvite(@CurrentUser() user: JwtPayload, @Body() dto: CreateCircleInviteDto, @Res({ passthrough: true }) res: Response) {
    const invite = await this.invites.create(user.sub, dto);
    setCreated(res, `/v1/circles/invites/${invite.id}`);
    return invite;
  }

  @Post('invites/redeem')
  @HttpCode(HttpStatus.OK)
  @Throttle(JOIN_THROTTLE)
  redeemInvite(@CurrentUser() user: JwtPayload, @Body() dto: RedeemCircleInviteDto) {
    return this.invites.redeem(user.sub, dto);
  }

  @Delete('invites/:inviteId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async revokeInvite(@CurrentUser() user: JwtPayload, @Param('inviteId', ParseUUIDPipe) inviteId: string): Promise<void> {
    await this.invites.revoke(user.sub, inviteId);
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

  @Get(':id/messages')
  @Header('Cache-Control', PRIVATE_CACHE_HEADER)
  messages(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string, @Query() query: MessagesQueryDto) {
    return this.feed.messages(user.sub, id, query);
  }

  @Post(':id/messages')
  @HttpCode(HttpStatus.CREATED)
  @Throttle(MESSAGE_THROTTLE)
  sendMessage(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string, @Body() dto: SendMessageDto) {
    return this.feed.send(user.sub, id, dto);
  }

  @Put(':id/messages/:messageId/save')
  @HttpCode(HttpStatus.OK)
  @Throttle(MESSAGE_THROTTLE)
  saveMessage(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('messageId', ParseUUIDPipe) messageId: string,
  ) {
    return this.feed.save(user.sub, id, messageId);
  }

  @Delete(':id/messages/:messageId/save')
  @HttpCode(HttpStatus.NO_CONTENT)
  async unsaveMessage(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('messageId', ParseUUIDPipe) messageId: string,
  ): Promise<void> {
    await this.feed.unsave(user.sub, id, messageId);
  }

  @Post(':id/rounds')
  @HttpCode(HttpStatus.CREATED)
  @Throttle(ROUND_THROTTLE)
  startRound(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string, @Body() dto: StartRoundDto) {
    return this.feed.startRound(user.sub, id, dto);
  }

  @Post(':id/rounds/:roundId/end')
  @HttpCode(HttpStatus.OK)
  @Throttle(ROUND_THROTTLE)
  endRound(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('roundId', ParseUUIDPipe) roundId: string,
    @Body() dto: EndRoundDto,
  ) {
    return this.feed.endRound(user.sub, id, roundId, dto);
  }

  @Post(':id/rounds/:roundId/replies')
  @HttpCode(HttpStatus.CREATED)
  @Throttle(MESSAGE_THROTTLE)
  replyToRound(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('roundId', ParseUUIDPipe) roundId: string,
    @Body() dto: ReplyRoundDto,
  ) {
    return this.feed.replyToRound(user.sub, id, roundId, dto);
  }

  @Post(':id/reports')
  @HttpCode(HttpStatus.OK)
  @Throttle(REPORT_THROTTLE)
  report(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ReportDto) {
    return this.feed.report(user.sub, id, dto);
  }

  @Put(':id/mutes/:memberId')
  @HttpCode(HttpStatus.OK)
  mute(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
  ) {
    return this.feed.mute(user.sub, id, memberId);
  }

  @Delete(':id/mutes/:memberId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async unmute(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
  ): Promise<void> {
    await this.feed.unmute(user.sub, id, memberId);
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

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.circles.deleteCircle(user.sub, id);
  }
}
