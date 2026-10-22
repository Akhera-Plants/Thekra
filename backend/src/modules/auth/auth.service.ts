import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { hash as argon2hash, verify as argon2verify, argon2id } from 'argon2';
import type { HashOptions } from 'argon2';
import { randomUUID } from 'node:crypto';
import type { EnvironmentVariables } from '../../config/env.validation.js';
import type { JwtPayload } from '../../common/decorators/current-user.decorator.js';
import { UsersService } from '../users/users.service.js';
import type { RegisterDto } from './dto/register.dto.js';
import type { LoginDto } from './dto/login.dto.js';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  /** Access token TTL in seconds (for clients to schedule a refresh). */
  expiresIn: number;
}

export interface AuthResponse {
  user: {
    id: string;
    email: string;
    displayName: string | null;
    role: string;
  };
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

/**
 * argon2id OWASP baseline (memory 19 MiB / time 2 / parallelism 1).
 * Decision: argon2id chosen over bcrypt for memory-hardness per §7.1.
 * Note: argon2.argon2id === 2 (numeric constant) per the library API.
 */
const ARGON2_OPTIONS: HashOptions = {
  type: argon2id,
  memoryCost: 19456, // 19 MiB
  timeCost: 2,
  parallelism: 1,
};

/** Convert a vercel/ms string like '15m' or '30d' to seconds. */
function parseTtlToSeconds(ttl: string): number {
  const match = /^(\d+)([smhd])$/.exec(ttl);
  if (!match) return 900; // default 15 min
  const n = parseInt(match[1]!, 10);
  const unit = match[2]!;
  const map: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
  return n * (map[unit] ?? 1);
}

@Injectable()
export class AuthService {
  private readonly accessSecret: string;
  private readonly refreshSecret: string;
  private readonly accessTtlSeconds: number;
  private readonly refreshTtlSeconds: number;

  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<EnvironmentVariables>,
  ) {
    this.accessSecret =
      config.get<string>('JWT_ACCESS_SECRET') ??
      'thekra-access-secret-change-in-production';
    this.refreshSecret =
      config.get<string>('JWT_REFRESH_SECRET') ??
      'thekra-refresh-secret-change-in-production';
    const accessTtl = config.get<string>('ACCESS_TTL') ?? '15m';
    const refreshTtl = config.get<string>('REFRESH_TTL') ?? '30d';
    this.accessTtlSeconds = parseTtlToSeconds(accessTtl);
    this.refreshTtlSeconds = parseTtlToSeconds(refreshTtl);
  }

  // ── Public API ────────────────────────────────────────────────────────────

  async register(dto: RegisterDto): Promise<AuthResponse> {
    const email = dto.email.toLowerCase().trim();

    // Hash even if email already exists — constant-time path to avoid timing oracle.
    const passwordHash = await argon2hash(dto.password, ARGON2_OPTIONS);

    const existing = await this.users.findByEmail(email);
    if (existing) {
      throw new ConflictException({
        code: 'EMAIL_ALREADY_REGISTERED',
        message: 'An account with this email already exists.',
      });
    }

    const user = await this.users.create({
      email,
      passwordHash,
      displayName: dto.displayName,
    });

    void this.users.touchLastLogin(user.id);
    const tokens = this.issueTokens(user.id, user.email, user.role);
    return { user: this.safeUser(user), ...tokens };
  }

  async login(dto: LoginDto): Promise<AuthResponse> {
    const email = dto.email.toLowerCase().trim();
    const user = await this.users.findByEmail(email);

    // Always run argon2.verify to prevent timing oracle.
    const dummyHash =
      '$argon2id$v=19$m=19456,t=2,p=1$AAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
    const hashToVerify = user?.passwordHash ?? dummyHash;
    const valid = await argon2verify(hashToVerify, dto.password);

    if (!user || !valid) {
      throw new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password.',
      });
    }

    void this.users.touchLastLogin(user.id);
    const tokens = this.issueTokens(user.id, user.email, user.role);
    return { user: this.safeUser(user), ...tokens };
  }

  /**
   * Rotating refresh: validates the old refresh token and issues a new pair.
   * Phase 4 is stateless so old refresh tokens are not actively revoked —
   * documented honestly; revocation table deferred to Phase 5.
   */
  async refresh(rawRefreshToken: string): Promise<TokenPair> {
    let payload: JwtPayload;
    try {
      payload = this.jwt.verify<JwtPayload>(rawRefreshToken, {
        secret: this.refreshSecret,
      });
    } catch {
      throw new UnauthorizedException({
        code: 'INVALID_REFRESH_TOKEN',
        message: 'Refresh token is invalid or expired.',
      });
    }

    // Confirm the user still exists (e.g. account deleted between refreshes).
    const user = await this.users.findById(payload.sub);
    if (!user) {
      throw new UnauthorizedException({
        code: 'INVALID_REFRESH_TOKEN',
        message: 'Refresh token is invalid or expired.',
      });
    }

    return this.issueTokens(user.id, user.email, user.role);
  }

  // ── Internal helpers ──────────────────────────────────────────────────────

  private issueTokens(userId: string, email: string, role: string): TokenPair {
    const jwtPayload: JwtPayload = { sub: userId, email, role };
    // expiresIn must be a number (seconds) for @nestjs/jwt v12 strict types
    const accessToken = this.jwt.sign(jwtPayload, {
      secret: this.accessSecret,
      expiresIn: this.accessTtlSeconds,
    });
    // jti makes each refresh token unique even within the same second so
    // "rotating" pairs are observably distinct for mobile SecureStore swaps.
    const refreshToken = this.jwt.sign(
      { ...jwtPayload, jti: randomUUID() },
      {
        secret: this.refreshSecret,
        expiresIn: this.refreshTtlSeconds,
      },
    );
    return { accessToken, refreshToken, expiresIn: this.accessTtlSeconds };
  }

  private safeUser(user: {
    id: string;
    email: string;
    displayName: string | null;
    role: string;
  }) {
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
    };
  }

  /** Exposed for tests — hash a password without the full register flow. */
  hashPassword(password: string): Promise<string> {
    return argon2hash(password, ARGON2_OPTIONS);
  }

  /** Exposed for tests. */
  verifyPassword(hash: string, password: string): Promise<boolean> {
    return argon2verify(hash, password);
  }
}
