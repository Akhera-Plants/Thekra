import { IsBoolean, IsIn, IsOptional } from 'class-validator';
import { ToBoolean } from '../../../common/decorators/to-boolean.decorator.js';

export class QuoteDetailQueryDto {
  @IsOptional()
  @IsIn(['ar', 'en'])
  lang?: 'ar' | 'en' = 'ar';

  @IsOptional()
  @ToBoolean()
  @IsBoolean()
  includeAllTranslations?: boolean = false;

  @IsOptional()
  @ToBoolean()
  @IsBoolean()
  includeLinks?: boolean = true;
}
