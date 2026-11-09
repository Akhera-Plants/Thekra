/**
 * The kind sentence for a failed «أبلغ عن خطأ» (round 6, C-01s: the endpoint is abuse-limited). Pure: an error in,
 * an i18n key out.
 * - 429 `REPORTS_PAUSED`: every report of the day reached the global cap (until 00:00 UTC);
 * - 429 `REPORT_RATE_LIMITED` (or any other 429): this reporter sent many in a short time;
 * - 413: the note is longer than the server takes;
 * - no answer: offline; anything else: a calm generic line.
 */

import { ApiError } from '../types/api';

export function reportErrorKey(error: unknown): string {
  if (!(error instanceof ApiError)) return 'report.errors.generic';
  if (error.status === 0 || error.code === 'NETWORK_ERROR') return 'errors.network';
  if (error.status === 429) return error.code === 'REPORTS_PAUSED' ? 'report.errors.paused' : 'report.errors.tooMany';
  if (error.status === 413 || error.code === 'PAYLOAD_TOO_LARGE') return 'report.errors.tooLong';
  if (error.status === 404) return 'report.errors.gone';
  return 'report.errors.generic';
}
