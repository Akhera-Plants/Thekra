import { ValidateIf } from 'class-validator';

/**
 * Use on PATCH DTO fields that are **non-nullable in the database**.
 *
 * - Omitting the field (undefined) → validation skipped → Prisma ignores it ✓
 * - Sending `null` explicitly → validation runs → @IsString() / @IsUUID() etc. rejects it ✓
 *
 * Unlike @IsOptional() (which skips validation for both null and undefined),
 * this decorator only skips when the value is strictly undefined.
 */
export const IsOptionalNotNull = () => ValidateIf((_, v) => v !== undefined);
