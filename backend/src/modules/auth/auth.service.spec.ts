import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from './auth.service.js';
import { UsersService } from '../users/users.service.js';
import type { User } from '@prisma/client';
import type { EnvironmentVariables } from '../../config/env.validation.js';

// ── Minimal stubs ────────────────────────────────────────────────────────────

const mockUser: User = {
  id: 'user-uuid-1',
  email: 'test@example.com',
  displayName: 'Test User',
  passwordHash: '', // filled per test
  role: 'USER' as never,
  lastLoginAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function makeUsers(overrides?: Partial<UsersService>): UsersService {
  return {
    findByEmail: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    touchLastLogin: vi.fn().mockResolvedValue(mockUser),
    ...overrides,
  } as unknown as UsersService;
}

function makeConfig(
  overrides?: Record<string, string>,
): ConfigService<EnvironmentVariables> {
  const defaults: Record<string, string> = {
    JWT_ACCESS_SECRET: 'test-access-secret',
    JWT_REFRESH_SECRET: 'test-refresh-secret',
    ACCESS_TTL: '15m',
    REFRESH_TTL: '30d',
    ...overrides,
  };
  return {
    get: (key: string) => defaults[key],
  } as unknown as ConfigService<EnvironmentVariables>;
}

function makeJwt(): JwtService {
  return {
    sign: vi.fn().mockReturnValue('signed-token'),
    verify: vi.fn(),
  } as unknown as JwtService;
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('AuthService', () => {
  let users: ReturnType<typeof makeUsers>;
  let jwt: JwtService;
  let svc: AuthService;

  beforeEach(async () => {
    users = makeUsers();
    jwt = makeJwt();
    svc = new AuthService(users, jwt, makeConfig());
  });

  // ── register ─────────────────────────────────────────────────────────────

  describe('register', () => {
    it('creates user and returns tokens', async () => {
      vi.mocked(users.findByEmail).mockResolvedValue(null);
      vi.mocked(users.create).mockResolvedValue({ ...mockUser, id: 'new-id', email: 'new@example.com' });

      const result = await svc.register({
        email: 'new@example.com',
        password: 'password123456',
      });

      expect(result.accessToken).toBe('signed-token');
      expect(result.refreshToken).toBe('signed-token');
      expect(result.user.email).toBe('new@example.com');
      // passwordHash must NEVER appear in the response
      expect(result).not.toHaveProperty('passwordHash');
      expect((result.user as Record<string, unknown>)['passwordHash']).toBeUndefined();
    });

    it('normalises email to lowercase', async () => {
      vi.mocked(users.findByEmail).mockResolvedValue(null);
      vi.mocked(users.create).mockResolvedValue({ ...mockUser, email: 'lower@example.com' });

      await svc.register({ email: 'UPPER@EXAMPLE.COM', password: 'password123456' });

      expect(users.findByEmail).toHaveBeenCalledWith('upper@example.com');
    });

    it('throws 409 EMAIL_ALREADY_REGISTERED when email taken', async () => {
      vi.mocked(users.findByEmail).mockResolvedValue(mockUser);

      await expect(
        svc.register({ email: 'test@example.com', password: 'password123456' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  // ── login ─────────────────────────────────────────────────────────────────

  describe('login', () => {
    it('unknown email and wrong password produce the SAME error code', async () => {
      // Unknown email path
      vi.mocked(users.findByEmail).mockResolvedValue(null);
      const errUnknown = await svc
        .login({ email: 'nope@example.com', password: 'wrongwrong' })
        .catch((e) => e);

      // Wrong password path
      const hashed = await svc.hashPassword('correctpassword');
      vi.mocked(users.findByEmail).mockResolvedValue({ ...mockUser, passwordHash: hashed });
      const errWrong = await svc
        .login({ email: 'test@example.com', password: 'wrongpassword' })
        .catch((e) => e);

      expect(errUnknown).toBeInstanceOf(UnauthorizedException);
      expect(errWrong).toBeInstanceOf(UnauthorizedException);
      expect((errUnknown as UnauthorizedException).getResponse()).toMatchObject({
        code: 'INVALID_CREDENTIALS',
      });
      expect((errWrong as UnauthorizedException).getResponse()).toMatchObject({
        code: 'INVALID_CREDENTIALS',
      });
    });

    it('returns tokens on valid credentials', async () => {
      const hashed = await svc.hashPassword('goodpassword1');
      vi.mocked(users.findByEmail).mockResolvedValue({ ...mockUser, passwordHash: hashed });

      const result = await svc.login({ email: 'test@example.com', password: 'goodpassword1' });
      expect(result.accessToken).toBeTruthy();
      expect(result.refreshToken).toBeTruthy();
    });
  });

  // ── refresh ───────────────────────────────────────────────────────────────

  describe('refresh', () => {
    it('issues a new token pair on valid refresh token', async () => {
      const payload = { sub: 'user-uuid-1', email: 'test@example.com', role: 'USER' };
      vi.mocked(jwt.verify as ReturnType<typeof vi.fn>).mockReturnValue(payload);
      vi.mocked(users.findById).mockResolvedValue(mockUser);

      const result = await svc.refresh('valid-refresh-token');
      expect(result.accessToken).toBe('signed-token');
      expect(result.refreshToken).toBe('signed-token');
    });

    it('throws 401 INVALID_REFRESH_TOKEN on bad token', async () => {
      vi.mocked(jwt.verify as ReturnType<typeof vi.fn>).mockImplementation(() => {
        throw new Error('jwt expired');
      });

      await expect(svc.refresh('bad-token')).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('throws 401 when user no longer exists', async () => {
      const payload = { sub: 'gone-user', email: 'gone@example.com', role: 'USER' };
      vi.mocked(jwt.verify as ReturnType<typeof vi.fn>).mockReturnValue(payload);
      vi.mocked(users.findById).mockResolvedValue(null);

      await expect(svc.refresh('valid-token-for-deleted-user')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });
  });

  // ── hash/verify ───────────────────────────────────────────────────────────

  describe('hashPassword / verifyPassword', () => {
    it('produces a verifiable hash', async () => {
      const hash = await svc.hashPassword('mypassword');
      expect(hash).not.toBe('mypassword');
      expect(await svc.verifyPassword(hash, 'mypassword')).toBe(true);
      expect(await svc.verifyPassword(hash, 'wrongpassword')).toBe(false);
    });
  });
});
