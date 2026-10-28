import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser, type JwtPayload } from '../../common/decorators/current-user.decorator.js';
import { PRIVATE_CACHE_HEADER } from '../../common/http/public-cache.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AccountService } from './account.service.js';
import { AuthService } from './auth.service.js';
import { DeleteAccountDto } from './dto/delete-account.dto.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { LoginDto } from './dto/login.dto.js';
import { RefreshTokenDto } from './dto/refresh-token.dto.js';
import { RegisterDto } from './dto/register.dto.js';

/**
 * 5 requests per minute per IP on /auth/* (password guessing, sign-up spam).
 * Enforced by the global ThrottlerGuard (APP_GUARD in AppModule).
 */
const AUTH_THROTTLE = { default: { limit: 5, ttl: 60_000 } };

/**
 * Refresh is looser: the Next.js /api/auth/refresh route calls it on every full
 * page load of a signed-in admin, and it already needs a valid signed token.
 */
const REFRESH_THROTTLE = { default: { limit: 30, ttl: 60_000 } };

@Controller('auth')
@Throttle(AUTH_THROTTLE)
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly accountService: AccountService,
    private readonly prisma: PrismaService,
  ) {}

  /** #19 POST /v1/auth/register */
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() dto: RegisterDto) {
    const result = await this.authService.register(dto);
    return { data: result };
  }

  /** #20 POST /v1/auth/login */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto) {
    const result = await this.authService.login(dto);
    return { data: result };
  }

  /** #21 POST /v1/auth/refresh */
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle(REFRESH_THROTTLE)
  async refresh(@Body() dto: RefreshTokenDto) {
    const tokens = await this.authService.refresh(dto.refreshToken);
    return { data: tokens };
  }

  /** #22 GET /v1/auth/me */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser() user: JwtPayload) {
    const [dbUser, favoriteCount] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({ where: { id: user.sub } }),
      this.prisma.favorite.count({ where: { userId: user.sub } }),
    ]);
    return {
      data: {
        id: dbUser.id,
        email: dbUser.email,
        displayName: dbUser.displayName,
        role: dbUser.role,
        favoriteCount,
        createdAt: dbUser.createdAt,
      },
    };
  }

  /** #82 GET /v1/auth/me/export — everything stored for the account, as JSON. */
  @Get('me/export')
  @UseGuards(JwtAuthGuard)
  @Header('Cache-Control', PRIVATE_CACHE_HEADER)
  @Header('Content-Disposition', 'attachment; filename="thekra-export.json"')
  async exportMe(@CurrentUser() user: JwtPayload) {
    return { data: await this.accountService.exportAccount(user.sub) };
  }

  /** #83 DELETE /v1/auth/me — re-enter the password; favorites and the practice store cascade. */
  @Delete('me')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteMe(@CurrentUser() user: JwtPayload, @Body() dto: DeleteAccountDto): Promise<void> {
    await this.accountService.deleteAccount(user.sub, dto.password);
  }

  /**
   * #23 POST /v1/auth/logout
   *
   * Phase 4 is stateless — no token revocation table yet.
   * The client is responsible for dropping its tokens.
   * Documented honestly: this becomes a real revocation in Phase 5
   * once a RefreshToken table is added (backend-plan §9).
   */
  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  logout(): void {
    // Stateless logout — client drops tokens. No body.
  }
}
