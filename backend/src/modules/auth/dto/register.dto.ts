import { Transform } from 'class-transformer';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
  @IsEmail()
  @MaxLength(254)
  email!: string;

  /** Min 10 chars per §7.1; max 128 to limit hash computation cost. */
  @IsString()
  @MinLength(10)
  @MaxLength(128)
  password!: string;

  /** Required (owner, 2026-11-01): every account has a name. Trimmed, so spaces alone are refused. */
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  displayName!: string;
}
