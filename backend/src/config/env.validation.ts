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

  // ── Phase 5: Content-sync ──────────────────────────────────────────────────

  /**
   * Master kill switch for the scheduled content-sync cron jobs.
   * Default is false — local and CI must never fire a real provider on a timer.
   * Set to "true" in staging/production to enable cron jobs.
   * Manual `POST /v1/admin/content-sync/runs` always works regardless of this flag.
   */
  @IsOptional()
  @IsString()
  SYNC_ENABLED?: string = 'false';

  /**
   * Minutes after which a RUNNING SyncLog row is considered stale.
   * Default: 120. Stale rows are marked FAILED at startup.
   */
  @IsOptional()
  @IsInt()
  @Min(1)
  SYNC_STALE_AFTER_MINUTES?: number = 120;

  /** Maximum number of HTTP requests per sync run before the run ends cleanly. */
  @IsOptional()
  @IsInt()
  @Min(1)
  SYNC_MAX_REQUESTS_PER_RUN?: number = 2000;

  /** Maximum duration (minutes) for a sync run before it ends cleanly. */
  @IsOptional()
  @IsInt()
  @Min(1)
  SYNC_MAX_DURATION_MINUTES?: number = 30;

  /** Max record-level failures before the run is aborted. */
  @IsOptional()
  @IsInt()
  @Min(1)
  SYNC_MAX_RECORD_FAILURES?: number = 50;

  /** Cron expression for the Quran full-sync. Default: Sunday 03:00 UTC. */
  @IsOptional()
  @IsString()
  SYNC_QURAN_CRON?: string;

  /** Cron expression for the Hadith incremental sync. Default: daily 04:00 UTC. */
  @IsOptional()
  @IsString()
  SYNC_HADITH_CRON?: string;

  // ── Phase 5: Provider API keys (all optional) ──────────────────────────────

  /**
   * Optional bearer token for Quran.com API.
   * If absent, requests are made without auth (the API may still work).
   */
  @IsOptional()
  @IsString()
  QURAN_API_TOKEN?: string;

  /**
   * Optional client ID for Quran.com API (some auth flows use this).
   */
  @IsOptional()
  @IsString()
  QURAN_API_CLIENT_ID?: string;

  /**
   * Base URL for the Quran.com API. Defaults to https://api.quran.com/api/v4.
   * Override in tests or if the API endpoint changes.
   */
  @IsOptional()
  @IsString()
  QURAN_API_BASE_URL?: string = 'https://api.quran.com/api/v4';

  /**
   * Comma-separated list of Quran.com translation resource IDs.
   * Default: 131 (English Sahih International).
   */
  @IsOptional()
  @IsString()
  QURAN_TRANSLATION_IDS?: string = '131';

  /**
   * Which Arabic text field to use from Quran.com: 'text_uthmani' (default)
   * or 'text_imlaei'.
   */
  @IsOptional()
  @IsIn(['text_uthmani', 'text_imlaei'])
  QURAN_TEXT_FIELD?: 'text_uthmani' | 'text_imlaei' = 'text_uthmani';

  /**
   * API key for sunnah.com. Required to run the Sunnah provider.
   */
  @IsOptional()
  @IsString()
  SUNNAH_API_KEY?: string;

  /**
   * API key for hadithapi.com (passed as ?apiKey= query param).
   * Required to run the HadithApi provider.
   * NEVER stored in rawPayload.
   */
  @IsOptional()
  @IsString()
  HADITH_API_KEY?: string;

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

  /**
   * Express "trust proxy" setting. Rate limiting keys on the client IP, so
   * behind a load balancer / platform proxy this must be set (usually `1`, the
   * number of proxy hops) or every visitor shares the proxy's single bucket.
   * Leave unset when the API is reached directly. Accepts a hop count, `true`,
   * or an Express trust-proxy list such as `loopback`.
   */
  @IsOptional()
  @IsString()
  TRUST_PROXY?: string;

  // ── Web push (docs/plan/2026-10-web-push.md) ──────────────────────────────
  // All optional: web push is on only when every one below is set (push-config.ts). The QStash and cron
  // variables are temporary, for Vercel Hobby: docs/deploy/MIGRATION_OFF_VERCEL.md.

  /** VAPID key pair (base64url), from `pnpm --filter backend push:keys`. The public key is served to browsers. */
  @IsOptional()
  @IsString()
  VAPID_PUBLIC_KEY?: string;

  @IsOptional()
  @IsString()
  VAPID_PRIVATE_KEY?: string;

  /** Contact for push services: `mailto:…` or an https URL. */
  @IsOptional()
  @IsString()
  VAPID_SUBJECT?: string;

  /** Public base URL of this API (e.g. https://thekra.vercel.app); QStash calls `<it>/v1/push/deliver`. */
  @IsOptional()
  @IsString()
  PUSH_PUBLIC_API_URL?: string;

  /** Upstash QStash: the token publishes, the signing keys verify what QStash delivers. */
  @IsOptional()
  @IsString()
  QSTASH_TOKEN?: string;

  /** QStash API server of the account's region, as the Upstash console shows it. Default: https://qstash.upstash.io */
  @IsOptional()
  @IsString()
  QSTASH_URL?: string;

  @IsOptional()
  @IsString()
  QSTASH_CURRENT_SIGNING_KEY?: string;

  @IsOptional()
  @IsString()
  QSTASH_NEXT_SIGNING_KEY?: string;

  /** Vercel sends `Authorization: Bearer <CRON_SECRET>` with each cron call (GET /v1/push/refill). */
  @IsOptional()
  @IsString()
  CRON_SECRET?: string;
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

  // JWT secrets in production: fail fast at boot unless both are set to
  // strong, distinct, non-default values. (The class defaults above exist only
  // so local development and tests boot without extra setup.)
  if (validated.NODE_ENV === 'production') {
    assertProductionJwtSecrets(validated.JWT_ACCESS_SECRET, validated.JWT_REFRESH_SECRET);
  }

  return validated;
}

const DEFAULT_JWT_SECRETS = new Set([
  'thekra-access-secret-change-in-production',
  'thekra-refresh-secret-change-in-production',
]);
const MIN_JWT_SECRET_LENGTH = 32;

export function assertProductionJwtSecrets(
  access: string | undefined,
  refresh: string | undefined,
): void {
  const problems: string[] = [];
  for (const [name, value] of [
    ['JWT_ACCESS_SECRET', access],
    ['JWT_REFRESH_SECRET', refresh],
  ] as const) {
    if (!value || DEFAULT_JWT_SECRETS.has(value)) {
      problems.push(`${name} must be set to a non-default value`);
    } else if (value.length < MIN_JWT_SECRET_LENGTH) {
      problems.push(`${name} must be at least ${MIN_JWT_SECRET_LENGTH} characters`);
    }
  }
  if (access && access === refresh) {
    problems.push('JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must differ');
  }
  if (problems.length > 0) {
    throw new Error(`Invalid environment (production): ${problems.join('; ')}.`);
  }
}
