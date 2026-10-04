import { SourceType } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsOptional,
} from 'class-validator';
import { ToBoolean } from '../../../common/decorators/to-boolean.decorator.js';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto.js';

export class SourcesQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(['ar', 'en'])
  lang?: 'ar' | 'en' = 'ar';

  @IsOptional()
  @IsEnum(SourceType)
  type?: SourceType;

  @IsOptional()
  @ToBoolean()
  @IsBoolean()
  isExternalApi?: boolean;
}
