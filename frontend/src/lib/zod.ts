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
