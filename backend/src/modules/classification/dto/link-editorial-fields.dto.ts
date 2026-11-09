import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { LinkConcern } from '@prisma/client';

const trimOrNull = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() || null : value);

/**
 * Round 6 (C-13 / C-01n) fields every topic↔text link PATCH accepts. Each takes `null` to clear.
 * «وجه التذكير» is written by a person (next phase); nothing generates it.
 */
export class LinkEditorialFieldsDto {
  /** «وجه التذكير»: why this text reminds of this topic (Arabic). */
  @IsOptional()
  @Transform(trimOrNull)
  @IsString()
  @MaxLength(2000)
  reminderAngle?: string | null;

  /** English «وجه التذكير», only when a person wrote it. */
  @IsOptional()
  @Transform(trimOrNull)
  @IsString()
  @MaxLength(2000)
  reminderAngleEn?: string | null;

  /** NO_REAL_LINK puts the link on the owner's list (GET /v1/admin/link-concerns); `null` takes it off. */
  @IsOptional()
  @IsEnum(LinkConcern)
  concern?: LinkConcern | null;

  @IsOptional()
  @Transform(trimOrNull)
  @IsString()
  @MaxLength(1000)
  concernNote?: string | null;
}
