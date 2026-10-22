/**
 * Input checks for `pnpm --filter backend admin:create`. Pure functions, no I/O,
 * so the unit test covers every refusal without a database.
 */

export const MIN_ADMIN_PASSWORD_LENGTH = 16;
/** Same ceiling as RegisterDto: bounds the argon2 work per hash. */
export const MAX_ADMIN_PASSWORD_LENGTH = 128;

/** Development seed accounts (prisma/seed.ts). They must never become production admins. */
const DEV_SEED_EMAILS = new Set(['user@thekra.local', 'admin@thekra.local']);

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface AdminInput {
  email: string;
  password: string;
  databaseUrl: string;
}

export class AdminInputError extends Error {
  readonly problems: readonly string[];

  constructor(problems: readonly string[]) {
    super(problems.join('\n'));
    this.name = 'AdminInputError';
    this.problems = problems;
  }
}

/** Validates ADMIN_EMAIL, ADMIN_PASSWORD, and DATABASE_URL; throws with every problem at once. */
export function parseAdminInput(env: Readonly<Record<string, string | undefined>>): AdminInput {
  const problems: string[] = [];

  const databaseUrl = env['DATABASE_URL']?.trim() ?? '';
  if (!databaseUrl) problems.push('DATABASE_URL is not set.');

  const email = (env['ADMIN_EMAIL'] ?? '').trim().toLowerCase();
  if (!email) problems.push('ADMIN_EMAIL is not set.');
  else if (!EMAIL_PATTERN.test(email)) problems.push('ADMIN_EMAIL is not an email address.');
  else if (DEV_SEED_EMAILS.has(email)) problems.push(`ADMIN_EMAIL ${email} is a development seed account.`);

  const password = env['ADMIN_PASSWORD'] ?? '';
  const length = [...password].length;
  if (!password) problems.push('ADMIN_PASSWORD is not set.');
  else if (length < MIN_ADMIN_PASSWORD_LENGTH) {
    problems.push(`ADMIN_PASSWORD must be at least ${MIN_ADMIN_PASSWORD_LENGTH} characters (got ${length}).`);
  } else if (length > MAX_ADMIN_PASSWORD_LENGTH) {
    problems.push(`ADMIN_PASSWORD must be at most ${MAX_ADMIN_PASSWORD_LENGTH} characters.`);
  } else if (password !== password.trim()) {
    problems.push('ADMIN_PASSWORD starts or ends with whitespace (a pasted newline?).');
  } else if (email && password.toLowerCase() === email) {
    problems.push('ADMIN_PASSWORD must not be the email address.');
  }

  if (problems.length > 0) throw new AdminInputError(problems);
  return { email, password, databaseUrl };
}

/** `host/database` for the log line. Never includes the user or the password. */
export function describeTarget(databaseUrl: string): string {
  const unparseable = '(unparseable DATABASE_URL)';
  try {
    const url = new URL(databaseUrl);
    // Anything else (e.g. «user:secret@host» parses with «user:» as the scheme) could echo a credential.
    if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.hostname) return unparseable;
    return `${url.hostname}${url.port ? `:${url.port}` : ''}${url.pathname}`;
  } catch {
    return unparseable;
  }
}
