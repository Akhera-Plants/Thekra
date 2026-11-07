/**
 * O-07 (owner round 5): `me` is called on every page load, so it must not share the 5-a-minute login limit.
 */
import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { AuthController, AUTH_THROTTLE, MEMBER_THROTTLE } from './auth.controller.js';

const LIMIT = 'THROTTLER:LIMITdefault';
const limitOf = (method: keyof AuthController) =>
  Reflect.getMetadata(LIMIT, AuthController.prototype[method] as object) ?? Reflect.getMetadata(LIMIT, AuthController);

describe('auth throttling', () => {
  it('keeps login and register at the strict limit', () => {
    expect(limitOf('login')).toBe(AUTH_THROTTLE.default.limit);
    expect(limitOf('register')).toBe(AUTH_THROTTLE.default.limit);
  });
  it('gives the signed-in reads a wide limit', () => {
    expect(limitOf('me')).toBe(MEMBER_THROTTLE.default.limit);
    expect(limitOf('logout')).toBe(MEMBER_THROTTLE.default.limit);
    expect(MEMBER_THROTTLE.default.limit).toBeGreaterThanOrEqual(60);
  });
});
