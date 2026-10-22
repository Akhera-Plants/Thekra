import { describe, expect, it } from 'vitest';
import { AdminInputError, describeTarget, parseAdminInput } from './input.js';

const VALID = {
  DATABASE_URL: 'postgresql://owner:secret@db.example.com:5432/neondb?sslmode=require',
  ADMIN_EMAIL: '  Owner@Example.com ',
  ADMIN_PASSWORD: 'correct horse battery staple',
};

function problemsFor(env: Record<string, string | undefined>): readonly string[] {
  try {
    parseAdminInput(env);
  } catch (error) {
    if (error instanceof AdminInputError) return error.problems;
    throw error;
  }
  return [];
}

describe('parseAdminInput', () => {
  it('accepts a valid input and normalises the email', () => {
    expect(parseAdminInput(VALID)).toEqual({
      email: 'owner@example.com',
      password: 'correct horse battery staple',
      databaseUrl: VALID.DATABASE_URL,
    });
  });

  it('accepts exactly 16 characters, counting code points', () => {
    expect(() => parseAdminInput({ ...VALID, ADMIN_PASSWORD: 'a'.repeat(16) })).not.toThrow();
    expect(() => parseAdminInput({ ...VALID, ADMIN_PASSWORD: 'كلمة-سر-طويلة-جدا' })).not.toThrow();
  });

  it('refuses a password under 16 characters', () => {
    expect(problemsFor({ ...VALID, ADMIN_PASSWORD: 'a'.repeat(15) })).toEqual([
      'ADMIN_PASSWORD must be at least 16 characters (got 15).',
    ]);
    // The development seed password is 14 characters.
    expect(problemsFor({ ...VALID, ADMIN_PASSWORD: 'password123456' })).toHaveLength(1);
  });

  it('refuses a password over 128 characters', () => {
    expect(problemsFor({ ...VALID, ADMIN_PASSWORD: 'a'.repeat(129) })).toEqual([
      'ADMIN_PASSWORD must be at most 128 characters.',
    ]);
  });

  it('refuses surrounding whitespace and the email as password', () => {
    expect(problemsFor({ ...VALID, ADMIN_PASSWORD: `${'a'.repeat(20)}\n` })[0]).toMatch(/whitespace/);
    expect(problemsFor({ ...VALID, ADMIN_EMAIL: 'long.owner.name@example.com', ADMIN_PASSWORD: 'Long.Owner.Name@example.com' }))
      .toEqual(['ADMIN_PASSWORD must not be the email address.']);
  });

  it('refuses a missing or malformed email and the development seed accounts', () => {
    expect(problemsFor({ ...VALID, ADMIN_EMAIL: undefined })).toEqual(['ADMIN_EMAIL is not set.']);
    expect(problemsFor({ ...VALID, ADMIN_EMAIL: 'not-an-email' })).toEqual(['ADMIN_EMAIL is not an email address.']);
    expect(problemsFor({ ...VALID, ADMIN_EMAIL: 'Admin@Thekra.local' })[0]).toMatch(/development seed account/);
  });

  it('reports every missing variable at once', () => {
    expect(problemsFor({})).toEqual([
      'DATABASE_URL is not set.',
      'ADMIN_EMAIL is not set.',
      'ADMIN_PASSWORD is not set.',
    ]);
  });
});

describe('describeTarget', () => {
  it('shows host and database without credentials', () => {
    const shown = describeTarget(VALID.DATABASE_URL);
    expect(shown).toBe('db.example.com:5432/neondb');
    expect(shown).not.toContain('secret');
    expect(shown).not.toContain('owner');
  });

  it('does not echo an unparseable URL', () => {
    expect(describeTarget('owner:secret@nowhere')).toBe('(unparseable DATABASE_URL)');
  });
});
