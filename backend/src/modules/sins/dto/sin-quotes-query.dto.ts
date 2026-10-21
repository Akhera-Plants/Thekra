import { HadithGrade, QuoteType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ToBoolean } from '../../../common/decorators/to-boolean.decorator.js';
import { TransformToArray } from '../../../common/decorators/transform-to-array.decorator.js';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto.js';
import { NotMawdu } from '../../hadith/grade-policy.js';

/** Coarse kind filter for the topic reader tabs. */
export type QuoteKind = 'verse' | 'hadith' | 'athar';

export class SinQuotesQueryDto extends PaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  override limit?: number = 10;

  @IsOptional()
  @IsIn(['ar', 'en'])
  lang?: 'ar' | 'en' = 'ar';

  @IsOptional()
  @TransformToArray()
  @IsEnum(QuoteType, { each: true })
  type?: QuoteType[];

  /**
   * Coarse kind filter for the reader tabs.
   * - verse  → QURAN_VERSE only
   * - hadith → HADITH rows where isAthar is false
   * - athar  → HADITH rows where isAthar=true, atharReviewDecision=KEEP
   * When omitted (or 'all'), all kinds are returned.
   */
  @IsOptional()
  @IsIn(['verse', 'hadith', 'athar'])
  kind?: QuoteKind;

  @IsOptional()
  @TransformToArray()
  @IsEnum(HadithGrade, { each: true })
  @NotMawdu()
  grades?: HadithGrade[];

  @IsOptional()
  @ToBoolean()
  @IsBoolean()
  includeWeak?: boolean = false;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  minScore?: number;

  @IsOptional()
  @ToBoolean()
  @IsBoolean()
  shuffle?: boolean = false;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  seed?: string;
}

export { SinQuotesQueryDto as GoodDeedQuotesQueryDto };
