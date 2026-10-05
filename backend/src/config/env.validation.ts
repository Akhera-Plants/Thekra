import { plainToInstance } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  validateSync,
} from 'class-validator';


export class EnvironmentVariables {
  @IsString()
  DATABASE_URL!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  PORT?: number = 3001;

  @IsOptional()
  @IsString()
  CORS_ORIGINS?: string = 'http://localhost:3000';

  @IsOptional()
  @IsIn(['development', 'test', 'production'])
  NODE_ENV?: 'development' | 'test' | 'production' = 'development';

  @IsOptional()
  @IsIn(['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent'])
  LOG_LEVEL?: string = 'info';

  /**
   * Minimum relevanceScore for a link to be placed in the shuffled "variety band".
   * Links with score >= this threshold are ordered by md5(link.id + seed); links
   * below the threshold follow in the normal LINK_ORDER. See backend-plan §4.2.
   */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  VARIETY_SCORE_FLOOR?: number = 70;

  /**
   * P2-8: Preferred Quran-verse provider key (e.g. 'quran.com').
   * When multiple provider rows exist for the same ayah, the preferred provider's
   * row is returned by findAyah and used for surah names in listSurahs.
   * Phase 5 will populate this via the content-sync pipeline.
   */
  @IsOptional()
  @IsString()
  QURAN_PREFERRED_PROVIDER?: string;

  /**
   * D-1: Stop-gap admin API key — kept for backwards compatibility during Phase 4
   * migration.  AdminApiKeyGuard is no longer on admin routes; this var is unused
   * by the app itself but kept in validation so existing .env files don't break.
   * Remove in a follow-up cleanup commit.
   */
  @IsOptional()
  @IsString()
  ADMIN_API_KEY?: string;

  // ── Phase 4: JWT auth ───────────────────────────────────────────────────

  /**
   * Secret used to sign access tokens.  Required in production.
   * In development/test a sensible default is supplied.
   */
  @IsOptional()
  @IsString()
  JWT_ACCESS_SECRET?: string = 'thekra-access-secret-change-in-production';

  /**
   * Secret used to sign refresh tokens (separate from access so a refresh token
   * cannot be replayed as an access token).  Required in production.
   */
  @IsOptional()
  @IsString()
  JWT_REFRESH_SECRET?: string = 'thekra-refresh-secret-change-in-production';

  /**
   * Access token lifetime as a vercel/ms string (e.g. '15m', '1h').
   * Default: 15 minutes.
   */
  @IsOptional()
  @IsString()
  ACCESS_TTL?: string = '15m';

  /**
   * Refresh token lifetime as a vercel/ms string (e.g. '30d').
   * Default: 30 days.
   */
  @IsOptional()
  @IsString()
  REFRESH_TTL?: string = '30d';
}

export function validateEnv(config: Record<string, unknown>): EnvironmentVariables {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validated, { skipMissingProperties: false });
  if (errors.length > 0) {
    const messages = errors
      .map((error) => Object.values(error.constraints ?? {}).join(', '))
      .join('; ');
    throw new Error(`Invalid environment: ${messages}`);
  }

  // Phase 4: JWT secrets must be non-default in production
  if (validated.NODE_ENV === 'production') {
    const defaultAccess = 'thekra-access-secret-change-in-production';
    const defaultRefresh = 'thekra-refresh-secret-change-in-production';
    if (
      validated.JWT_ACCESS_SECRET === defaultAccess ||
      validated.JWT_REFRESH_SECRET === defaultRefresh
    ) {
      throw new Error(
        'Invalid environment: JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be set to non-default values in production.',
      );
    }
  }

  return validated;
}
