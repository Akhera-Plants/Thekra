import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Min } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto.js';

export class SurahAyahsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(['ar', 'en'])
  lang?: 'ar' | 'en' = 'ar';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  fromAyah?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  toAyah?: number;
}
