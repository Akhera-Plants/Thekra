import { Type } from 'class-transformer';
import { IsInt, IsOptional, Matches, Max, Min } from 'class-validator';
import { LocaleQueryDto } from '../../../common/dto/locale-query.dto.js';

export const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * `?from=YYYY-MM-DD&to=YYYY-MM-DD&hijriOffset=-2..2`; the span rules live in PracticeService.
 * Accepts `lang` because the web and mobile clients add it to every public GET (the answer carries both titles).
 */
export class OccasionsQueryDto extends LocaleQueryDto {
  @IsOptional()
  @Matches(DATE_PATTERN, { message: 'from must be YYYY-MM-DD' })
  from?: string;

  @IsOptional()
  @Matches(DATE_PATTERN, { message: 'to must be YYYY-MM-DD' })
  to?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(-2)
  @Max(2)
  hijriOffset?: number;
}
