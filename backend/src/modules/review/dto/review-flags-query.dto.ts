import { FlagSeverity, FlagStatus, FlagType } from '@prisma/client';
import { IsEnum, IsIn, IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto.js';

export class ReviewFlagsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(['ar', 'en'])
  lang?: 'ar' | 'en' = 'ar';

  @IsOptional()
  @IsEnum(FlagType)
  type?: FlagType;

  @IsOptional()
  @IsEnum(FlagSeverity)
  severity?: FlagSeverity;

  @IsOptional()
  @IsEnum(FlagStatus)
  status?: FlagStatus;

  @IsOptional()
  @IsUUID()
  sourceId?: string;
}
