import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser, type JwtPayload } from '../../common/decorators/current-user.decorator.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuthService } from './auth.service.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { LoginDto } from './dto/login.dto.js';
import { RefreshTokenDto } from './dto/refresh-token.dto.js';
import { RegisterDto } from './dto/register.dto.js';

/** 10 requests per minute per IP on all /auth/* routes (§2.7). */
const AUTH_THROTTLE = { default: { limit: 10, ttl: 60000 } };

@Controller('auth')
@Throttle(AUTH_THROTTLE)
export class AuthController {
  constructor(
    private readonly authService: AuthService,
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
