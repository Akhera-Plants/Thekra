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
import { ToBoolean } from '../../../common/decorators/to-boolean.decorator.js';
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
  @ToBoolean()
  @IsBoolean()
  hasNote?: boolean;

  /**
   * D-2: `newest` restored after adding `createdAt DateTime @default(now())` to SinQuote
   * (migration 20261005000002_add_link_timestamps).  `newest` orders by `createdAt DESC, id ASC`.
   * Default remains `score` (relevanceScore DESC NULLS LAST, then id ASC).
   */
  @IsOptional()
  @IsIn(['score', 'newest'])
  sort?: 'score' | 'newest';
}
