/**
 * CORS_ORIGINS parsing and validation (pure; no Nest imports).
 *
 * The value is a comma-separated list. Each entry is either
 *   - an exact origin, `scheme://host[:port]` with no path or trailing slash
 *     (e.g. `https://thekra-web.vercel.app`, `http://localhost:3000`), or
 *   - a host pattern with exactly one `*` inside the leftmost host label
 *     (e.g. `https://thekra-web-*-almekdadmohammadgmailcoms-projects.vercel.app`).
 *     The `*` matches one or more of `[a-z0-9-]`: never a dot, slash, colon or
 *     scheme, so it cannot reach into another label, path or port.
 *
 * Empty entries (`a,,b`, a trailing comma) are skipped; an empty list allows
 * no browser origin. Anything else — a bare `*`, `null`, a malformed origin, a
 * pattern with several `*` or a whole-label `*` — throws, so a bad value fails
 * the boot instead of silently opening (or closing) the API. The app sends
 * `Access-Control-Allow-Credentials: true`, which must never be paired with a
 * wildcard or the `null` origin.
 *
 * The result is the `(string | RegExp)[]` form the `cors` middleware accepts:
 * strings compare with `===`, patterns are anchored RegExps without flags.
 */
export type CorsOriginRule = string | RegExp;

const WILDCARD = '*';
const WILDCARD_CLASS = '[a-z0-9-]+';
// Stands in for `*` while the pattern is validated as an ordinary origin.
const PLACEHOLDER = 'x0wildcard0x';

export class CorsOriginsConfigError extends Error {
  constructor(entry: string, reason: string) {
    super(`Invalid CORS_ORIGINS entry "${entry}": ${reason}`);
    this.name = 'CorsOriginsConfigError';
  }
}

/** True when `value` is already a serialized http(s) origin, exactly as browsers send it. */
function isSerializedOrigin(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  return (url.protocol === 'http:' || url.protocol === 'https:') && url.origin === value;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function compilePattern(entry: string): RegExp {
  if (entry.indexOf(WILDCARD) !== entry.lastIndexOf(WILDCARD)) {
    throw new CorsOriginsConfigError(entry, 'a pattern may contain only one "*"');
  }
  const candidate = entry.replace(WILDCARD, PLACEHOLDER);
  if (!isSerializedOrigin(candidate)) {
    throw new CorsOriginsConfigError(
      entry,
      'a pattern must be a lowercase http(s) origin with no path or trailing slash',
    );
  }
  const { hostname } = new URL(candidate);
  const labels = hostname.split('.');
  const [firstLabel] = labels;
  if (labels.length < 2 || !firstLabel?.includes(PLACEHOLDER)) {
    throw new CorsOriginsConfigError(
      entry,
      'the "*" must sit in the leftmost label of a multi-label host',
    );
  }
  if (firstLabel === PLACEHOLDER) {
    throw new CorsOriginsConfigError(
      entry,
      'a whole-label "*" trusts every subdomain; add a literal prefix or suffix, or list the origins',
    );
  }
  const [before, after] = entry.split(WILDCARD) as [string, string];
  return new RegExp(`^${escapeRegExp(before)}${WILDCARD_CLASS}${escapeRegExp(after)}$`);
}

/** Parses CORS_ORIGINS into rules for the `cors` middleware. Throws on unsafe or malformed entries. */
export function parseCorsOrigins(raw: string): CorsOriginRule[] {
  const rules: CorsOriginRule[] = [];
  for (const piece of raw.split(',')) {
    const entry = piece.trim();
    if (!entry) continue;
    if (entry === WILDCARD) {
      throw new CorsOriginsConfigError(
        entry,
        'a bare "*" is not allowed together with credentials; list the origins',
      );
    }
    if (entry.toLowerCase() === 'null') {
      throw new CorsOriginsConfigError(
        entry,
        'the "null" origin (sandboxed iframes, file://) must never be trusted with credentials',
      );
    }
    if (entry.includes(WILDCARD)) {
      rules.push(compilePattern(entry));
      continue;
    }
    if (!isSerializedOrigin(entry)) {
      throw new CorsOriginsConfigError(
        entry,
        'expected an origin such as https://example.com (lowercase, no path or trailing slash)',
      );
    }
    rules.push(entry);
  }
  return rules;
}

/**
 * Whether `origin` (the request's Origin header) matches a rule. Mirrors the
 * `cors` middleware's own check: `===` for strings, `RegExp#test` for patterns.
 * A request without an Origin header is never "allowed" here; it gets no CORS
 * headers and is served normally (server-to-server calls, curl).
 */
export function isAllowedCorsOrigin(rules: readonly CorsOriginRule[], origin: string | undefined): boolean {
  if (origin === undefined) return false;
  return rules.some((rule) => (typeof rule === 'string' ? rule === origin : rule.test(origin)));
}
