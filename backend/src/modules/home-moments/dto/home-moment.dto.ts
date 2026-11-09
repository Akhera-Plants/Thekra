import { OmitType, PartialType } from '@nestjs/mapped-types';
import { HomeMomentTopic } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength, ValidateIf } from 'class-validator';
import { MOMENT_ICON, MOMENT_KEY, MOMENT_LABEL_MAX, MOMENT_SITUATION_MAX } from '../home-moments-yaml.js';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
/** Control characters and bidi overrides are refused in text every user sees. */
const SAFE_TEXT = /^[^\p{Cc}‪-‮⁦-⁩]+$/u;

/** POST /admin/home-moments. `topicSlug` is the sin / good-deed slug, or the branch number for BRANCH. */
export class CreateHomeMomentDto {
  @IsString()
  @MaxLength(40)
  @Matches(MOMENT_KEY, { message: 'key must be kebab-case' })
  key!: string;

  @IsEnum(HomeMomentTopic)
  topicType!: HomeMomentTopic;

  @IsString()
  @MaxLength(80)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, { message: 'topicSlug must be a slug or a branch number' })
  topicSlug!: string;

  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(MOMENT_LABEL_MAX)
  @Matches(SAFE_TEXT)
  labelAr!: string;

  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(MOMENT_LABEL_MAX)
  @Matches(SAFE_TEXT)
  labelEn!: string;

  /** Pass `null` to clear. */
  @IsOptional()
  @Transform(trim)
  @ValidateIf((_o, value) => value !== null)
  @IsString()
  @MinLength(1)
  @MaxLength(MOMENT_SITUATION_MAX)
  @Matches(SAFE_TEXT)
  situationAr?: string | null;

  @IsOptional()
  @Transform(trim)
  @ValidateIf((_o, value) => value !== null)
  @IsString()
  @MinLength(1)
  @MaxLength(MOMENT_SITUATION_MAX)
  @Matches(SAFE_TEXT)
  situationEn?: string | null;

  @IsString()
  @MaxLength(32)
  @Matches(MOMENT_ICON, { message: 'icon must be a kebab-case key' })
  icon!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  published?: boolean;
}

/** PATCH /admin/home-moments/:id. The key is fixed once created. */
export class UpdateHomeMomentDto extends PartialType(OmitType(CreateHomeMomentDto, ['key'] as const)) {}
