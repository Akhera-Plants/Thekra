import { hash as argon2hash, argon2id } from 'argon2';
import type { HashOptions } from 'argon2';

/**
 * argon2id OWASP baseline (memory 19 MiB / time 2 / parallelism 1).
 * Decision: argon2id chosen over bcrypt for memory-hardness per §7.1.
 * Note: argon2.argon2id === 2 (numeric constant) per the library API.
 *
 * Plain module (no Nest decorators) so standalone scripts such as
 * scripts/admin/create-admin.ts hash with exactly the same settings.
 */
export const ARGON2_OPTIONS: HashOptions = {
  type: argon2id,
  memoryCost: 19456, // 19 MiB
  timeCost: 2,
  parallelism: 1,
};

/**
 * A well-formed argon2id hash that matches no password. Verified when the user is unknown, so an unknown
 * account costs the same time as a wrong password (no timing oracle).
 */
export const DUMMY_PASSWORD_HASH =
  '$argon2id$v=19$m=19456,t=2,p=1$AAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

export function hashPassword(password: string): Promise<string> {
  return argon2hash(password, ARGON2_OPTIONS);
}
