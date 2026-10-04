import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto.js';

export class SinQuotesAdminQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID()
  sinId?: string;

  @IsOptional()
  @IsUUID()
  quoteId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  minScore?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  maxScore?: number;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  hasNote?: boolean;

  @IsOptional()
  @IsIn(['score', 'newest'])
  sort?: 'score' | 'newest';
}
