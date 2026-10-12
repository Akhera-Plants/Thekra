import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto.js';

export class GoodDeedsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(['ar', 'en'])
  lang?: 'ar' | 'en' = 'ar';

  @IsOptional()
  @IsString()
  @MaxLength(100)
  category?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  q?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  oppositeSinSlug?: string;

  @IsOptional()
  @IsIn(['name', 'quoteCount'])
  sort?: 'name' | 'quoteCount' = 'name';

  /** «true» keeps deeds that have no published text. The public list hides them. */
  @IsOptional()
  @IsIn(['true', 'false'])
  includeEmpty?: 'true' | 'false';
}
