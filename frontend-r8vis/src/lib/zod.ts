/**
 * Project entry point for zod. Import `z` from here, not from 'zod'.
 *
 * jitless: zod v4 probes for `Function('')` to JIT-compile object parsers.
 * The production CSP has no 'unsafe-eval', so that probe is blocked and the
 * browser reports a CSP violation. Turning the JIT off skips the probe; zod
 * then uses its normal (non-eval) parser, which is fine for form-sized input.
 */
import { z } from 'zod';

z.config({ jitless: true });

export { z };

/**
 * Form messages in the page's language (owner, 2026-11-01: no English error on an Arabic page). zod v4 ships both
 * locales; forms that need a precise sentence pass their own message (the sign-in and sign-up forms do).
 */
export function setZodLocale(locale: 'ar' | 'en') {
  z.config(locale === 'ar' ? z.locales.ar() : z.locales.en());
}
