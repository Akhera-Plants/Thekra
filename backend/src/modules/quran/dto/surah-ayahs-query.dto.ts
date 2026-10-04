import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto.js';

export class SurahAyahsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(['ar', 'en'])
  lang?: 'ar' | 'en' = 'ar';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  /** P2-9: max 286 — the longest surah (Al-Baqarah). */
  @Max(286)
  fromAyah?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  /** P2-9: max 286 — the longest surah (Al-Baqarah). */
  @Max(286)
  toAyah?: number;
}
