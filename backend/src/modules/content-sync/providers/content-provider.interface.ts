/**
 * content-provider.interface.ts
 *
 * The contract every external-content provider must satisfy.
 * The interface is designed so that:
 *   - `mapToQuote` is **pure** (no I/O) and unit-testable against fixture JSON.
 *   - `fetchBatch` is the only I/O surface — stubbed in every test.
 *   - Adding a provider never touches the sync orchestrator (ContentSyncService).
 *
 * See content-pipeline-plan §2 for the full specification.
 */

import type { Source } from '@prisma/client';
import type { Prisma } from '@prisma/client';

/** Opaque cursor that tracks where we are in a provider's pagination. */
export interface ProviderCursor {
  /** 1-based page number within the current unit of work. */
  page: number;
  /** Surah range for Quran providers (inclusive). */
  surahFrom?: number;
  surahTo?: number;
  /** Collection slug for Hadith providers. */
  collection?: string;
  /** Book range within a collection (inclusive). */
  bookFrom?: number;
  bookTo?: number;
  /** Whether this is a dry-run (fetch + map, no writes). */
  dryRun?: boolean;
}

/** One page of raw records from the provider plus the next cursor. */
export interface ProviderBatch {
  /** Raw records as returned by the provider API (verbatim, for `rawPayload`). */
  records: unknown[];
  /** Cursor for the next page, or `null` when this was the last page. */
  nextCursor: ProviderCursor | null;
}

/**
 * A record that has been mapped to the Thekra schema.
 * `quote` carries all scalar fields; `translations` is the list of
 * Translation rows to upsert alongside it.
 */
export interface MappedQuote {
  /** Provider's natural key (namespaced by `apiProvider`). */
  externalId: string;
  /** All scalar Quote columns (without `id`, `apiProvider`, `externalId`, `origin`). */
  quote: Omit<
    Prisma.QuoteUncheckedCreateInput,
    'id' | 'apiProvider' | 'externalId' | 'origin'
  >;
  translations: { languageCode: string; text: string }[];
}

/**
 * The provider interface every adapter must implement.
 * Implementations live in this directory; they are registered in
 * `ContentSyncModule` and injected into `ContentSyncService` via a token.
 */
export interface ContentProvider {
  /** === Source.apiProvider, e.g. 'quran.com' */
  readonly key: string;

  /**
   * Returns false when a required API key or config is absent.
   * The executor calls this before creating a SyncLog — if false, it throws
   * 422 PROVIDER_NOT_CONFIGURED immediately rather than failing mid-run.
   */
  isConfigured(): boolean;

  /**
   * Fetch one page / unit of work from the provider.
   * MUST NOT be called in any test — stub the whole provider instead.
   * Raises `ProviderHttpError` for HTTP-level failures.
   */
  fetchBatch(cursor: ProviderCursor): Promise<ProviderBatch>;

  /**
   * Pure mapping from one raw provider record to a `MappedQuote`.
   * No network, no DB — testable with fixture JSON.
   * May throw `SkipRecordError` for records that should be silently skipped
   * (e.g. a Hadith record that has no Arabic text).
   */
  mapToQuote(raw: unknown, source: Source): MappedQuote;
}

// ─── Error types ──────────────────────────────────────────────────────────────

/** Thrown by `fetchBatch` on HTTP-level failures. */
export class ProviderHttpError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    /** If the provider sent `Retry-After`, this is the millisecond delay. */
    public readonly retryAfterMs?: number,
  ) {
    super(message);
    this.name = 'ProviderHttpError';
  }
}

/**
 * Thrown by `mapToQuote` for records that cannot be stored but should not
 * abort the run (e.g. no Arabic text, unsupported type).
 */
export class SkipRecordError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SkipRecordError';
  }
}

/**
 * Thrown by the executor when the per-run record-failure threshold is exceeded.
 * Treated as `FAILED` (not `SUCCESS` with partial stats).
 */
export class RunAbortedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RunAbortedError';
  }
}

/** Token used to inject the provider registry map in ContentSyncModule. */
export const CONTENT_PROVIDERS_TOKEN = 'CONTENT_PROVIDERS';
