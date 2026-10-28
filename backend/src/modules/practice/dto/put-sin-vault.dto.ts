import { IsIn, IsString, Max, MaxLength, Min } from 'class-validator';
import { IsStrictInt } from '../../../common/decorators/is-strict-int.decorator.js';

export const SIN_VAULT_KDF = 'pbkdf2-sha256';
export const SIN_VAULT_MIN_ITERATIONS = 210_000;
/** Largest ciphertext, in bytes after base64 decoding (contract §2: ≤ 128 KB). */
export const SIN_VAULT_MAX_CIPHERTEXT_BYTES = 128 * 1024;
/** Base64 length of {@link SIN_VAULT_MAX_CIPHERTEXT_BYTES}. */
const MAX_CIPHERTEXT_BASE64 = Math.ceil(SIN_VAULT_MAX_CIPHERTEXT_BYTES / 3) * 4;

/**
 * PUT /me/sin-vault. The server checks only the envelope (base64 shape and sizes, the KDF and its
 * iterations); the ciphertext is opaque. `version` is the version the client last read (0 before the
 * first save). Over-long strings are caught by SinVaultService as 413 / 400 with stable codes.
 */
export class PutSinVaultDto {
  @IsString()
  @MaxLength(MAX_CIPHERTEXT_BASE64 + 4096)
  ciphertext!: string;

  @IsString()
  @MaxLength(64)
  iv!: string;

  @IsString()
  @MaxLength(64)
  salt!: string;

  @IsIn([SIN_VAULT_KDF])
  kdf!: string;

  @IsStrictInt()
  @Min(SIN_VAULT_MIN_ITERATIONS)
  @Max(10_000_000)
  iterations!: number;

  @IsStrictInt()
  @Min(0)
  @Max(2_000_000_000)
  version!: number;
}
