import { IsEnum, IsIn, IsOptional } from 'class-validator';
import { QuoteType } from '@prisma/client';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto.js';

export class FavoritesQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(['ar', 'en'])
  lang?: 'ar' | 'en' = 'ar';

  @IsOptional()
  @IsEnum(QuoteType)
  type?: QuoteType;
}
