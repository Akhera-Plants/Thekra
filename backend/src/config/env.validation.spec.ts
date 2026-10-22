import { describe, expect, it } from 'vitest';
import { parseTrustProxy } from './configure-app.js';
import { assertProductionJwtSecrets, validateEnv } from './env.validation.js';

const STRONG_A = 'a'.repeat(48);
const STRONG_B = 'b'.repeat(48);
const BASE = { DATABASE_URL: 'postgresql://u:p@localhost:5432/db' };

describe('production JWT secret checks', () => {
  it('fails at boot when production uses the built-in defaults', () => {
    expect(() => validateEnv({ ...BASE, NODE_ENV: 'production' })).toThrow(
      /JWT_ACCESS_SECRET must be set/,
    );
  });

  it('rejects short, missing, or identical secrets', () => {
    expect(() => assertProductionJwtSecrets('short', STRONG_B)).toThrow(/at least 32/);
    expect(() => assertProductionJwtSecrets(undefined, STRONG_B)).toThrow(/must be set/);
    expect(() => assertProductionJwtSecrets(STRONG_A, STRONG_A)).toThrow(/must differ/);
    expect(() =>
      assertProductionJwtSecrets(STRONG_A, 'thekra-access-secret-change-in-production'),
    ).toThrow(/JWT_REFRESH_SECRET must be set/);
  });

  it('accepts strong distinct secrets in production', () => {
    expect(() =>
      validateEnv({
        ...BASE,
        NODE_ENV: 'production',
        JWT_ACCESS_SECRET: STRONG_A,
        JWT_REFRESH_SECRET: STRONG_B,
      }),
    ).not.toThrow();
  });

  it('keeps the development defaults outside production', () => {
    expect(() => validateEnv({ ...BASE, NODE_ENV: 'development' })).not.toThrow();
  });
});

describe('parseTrustProxy', () => {
  it('maps env strings to Express trust-proxy values', () => {
    expect(parseTrustProxy(undefined)).toBeUndefined();
    expect(parseTrustProxy('')).toBeUndefined();
    expect(parseTrustProxy('1')).toBe(1);
    expect(parseTrustProxy('true')).toBe(true);
    expect(parseTrustProxy('false')).toBe(false);
    expect(parseTrustProxy('loopback')).toBe('loopback');
  });
});
