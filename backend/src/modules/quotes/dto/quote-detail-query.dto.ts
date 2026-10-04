import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional } from 'class-validator';

export class QuoteDetailQueryDto {
  @IsOptional()
  @IsIn(['ar', 'en'])
  lang?: 'ar' | 'en' = 'ar';

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  includeAllTranslations?: boolean = false;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  includeLinks?: boolean = true;
}
