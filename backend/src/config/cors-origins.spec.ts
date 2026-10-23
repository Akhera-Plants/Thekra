import {
  BUILT_IN_CORS_ORIGINS,
  CorsOriginsConfigError,
  corsOriginRules,
  isAllowedCorsOrigin,
  parseCorsOrigins,
} from './cors-origins.js';

const PRODUCTION =
  'https://thekra-web.vercel.app,https://thekra-web-*-almekdadmohammadgmailcoms-projects.vercel.app,http://localhost:3000';
const PREVIEW = 'https://thekra-web-git-master-almekdadmohammadgmailcoms-projects.vercel.app';

describe('parseCorsOrigins', () => {
  const rules = parseCorsOrigins(PRODUCTION);
  const allowed = (origin: string | undefined) => isAllowedCorsOrigin(rules, origin);

  it('keeps exact origins as plain strings (same rule the cors middleware already used)', () => {
    expect(parseCorsOrigins('http://localhost:3000')).toEqual(['http://localhost:3000']);
    expect(rules[0]).toBe('https://thekra-web.vercel.app');
    expect(rules[2]).toBe('http://localhost:3000');
  });

  it('matches exact origins exactly', () => {
    expect(allowed('https://thekra-web.vercel.app')).toBe(true);
    expect(allowed('http://localhost:3000')).toBe(true);
    expect(allowed('http://localhost:3001')).toBe(false);
    expect(allowed('https://thekra-web.vercel.app/')).toBe(false);
    expect(allowed('https://THEKRA-web.vercel.app')).toBe(false);
  });

  it('compiles a single-* pattern to an anchored regex', () => {
    expect(rules[1]).toBeInstanceOf(RegExp);
    expect((rules[1] as RegExp).source).toBe(
      '^https:\\/\\/thekra-web-[a-z0-9-]+-almekdadmohammadgmailcoms-projects\\.vercel\\.app$',
    );
    expect((rules[1] as RegExp).flags).toBe('');
  });

  it('matches Vercel preview origins through the pattern', () => {
    expect(allowed(PREVIEW)).toBe(true);
    expect(allowed('https://thekra-web-k3j9x2abc-almekdadmohammadgmailcoms-projects.vercel.app')).toBe(true);
  });

  it('rejects origins the pattern must not reach', () => {
    expect(allowed('https://evil.com')).toBe(false);
    expect(allowed('https://thekra-web-x.vercel.app.evil.com')).toBe(false);
    expect(allowed(`${PREVIEW}.evil.com`)).toBe(false);
    expect(allowed(`${PREVIEW}:8443`)).toBe(false);
    // `*` never spans a dot or slash, and the empty match is not allowed
    expect(allowed('https://thekra-web-a.b-almekdadmohammadgmailcoms-projects.vercel.app')).toBe(false);
    expect(allowed('https://thekra-web-a/b-almekdadmohammadgmailcoms-projects.vercel.app')).toBe(false);
    expect(allowed('https://thekra-web--almekdadmohammadgmailcoms-projects.vercel.app')).toBe(false);
    expect(allowed('https://evil.com/https://thekra-web-x-almekdadmohammadgmailcoms-projects.vercel.app')).toBe(false);
    expect(allowed('null')).toBe(false);
    expect(allowed('')).toBe(false);
  });

  it('does not let http:// stand in for https:// (or the reverse)', () => {
    expect(allowed('http://thekra-web.vercel.app')).toBe(false);
    expect(allowed(PREVIEW.replace('https://', 'http://'))).toBe(false);
    expect(allowed('https://localhost:3000')).toBe(false);
  });

  it('treats a missing Origin header as "no CORS headers", not as an error', () => {
    expect(allowed(undefined)).toBe(false);
  });

  it('skips empty entries and whitespace', () => {
    expect(parseCorsOrigins(' http://localhost:3000 ,, https://thekra-web.vercel.app ,')).toEqual([
      'http://localhost:3000',
      'https://thekra-web.vercel.app',
    ]);
    expect(parseCorsOrigins('')).toEqual([]);
    expect(parseCorsOrigins(' , ')).toEqual([]);
    expect(isAllowedCorsOrigin(parseCorsOrigins(''), '')).toBe(false);
  });

  it.each([
    ['*', 'bare "*"'],
    ['http://localhost:3000,*', 'bare "*"'],
    ['null', '"null" origin'],
    ['NULL', '"null" origin'],
    ['https://*.vercel.app', 'whole-label "*"'],
    ['https://thekra-*-*.vercel.app', 'only one "*"'],
    ['https://app.*.example.com', 'leftmost label'],
    ['https://thekra-web-*', 'leftmost label'],
    ['http*://thekra-web.vercel.app', 'lowercase http(s) origin'],
    ['https://thekra-web.vercel.app:*', 'lowercase http(s) origin'],
    ['https://thekra-web-*.vercel.app/', 'lowercase http(s) origin'],
    ['https://Thekra-web-*.vercel.app', 'lowercase http(s) origin'],
    ['https://thekra-web.vercel.app/', 'expected an origin'],
    ['https://thekra-web.vercel.app/path', 'expected an origin'],
    ['thekra-web.vercel.app', 'expected an origin'],
    ['ftp://thekra-web.vercel.app', 'expected an origin'],
    ['https://Thekra-web.vercel.app', 'expected an origin'],
  ])('rejects %s at boot (%s)', (raw, reason) => {
    expect(() => parseCorsOrigins(raw)).toThrow(CorsOriginsConfigError);
    expect(() => parseCorsOrigins(raw)).toThrow(reason);
  });
});

describe('corsOriginRules', () => {
  it('always allows the public site and its previews, whatever CORS_ORIGINS holds', () => {
    for (const raw of [undefined, '', 'http://localhost:3000']) {
      const rules = corsOriginRules(raw);
      expect(isAllowedCorsOrigin(rules, 'https://thekra-web.vercel.app')).toBe(true);
      expect(isAllowedCorsOrigin(rules, PREVIEW)).toBe(true);
      expect(isAllowedCorsOrigin(rules, 'https://evil.example')).toBe(false);
    }
  });

  it('adds CORS_ORIGINS entries and drops duplicates of the built-in ones', () => {
    const rules = corsOriginRules(PRODUCTION);
    expect(rules).toHaveLength(BUILT_IN_CORS_ORIGINS.length + 1);
    expect(isAllowedCorsOrigin(rules, 'http://localhost:3000')).toBe(true);
  });

  it('still fails the boot on an unsafe CORS_ORIGINS', () => {
    expect(() => corsOriginRules('*')).toThrow(CorsOriginsConfigError);
  });
});
