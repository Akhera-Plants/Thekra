import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { LocaleQueryDto } from '../../../common/dto/locale-query.dto.js';

export const DEFAULT_ICS_MONTHS = 12;

/** `?lang=ar|en&months=1..24` for the public calendar feed. */
export class OccasionsIcsQueryDto extends LocaleQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(24)
  months?: number = DEFAULT_ICS_MONTHS;
}
