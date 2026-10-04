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

export class GoodDeedQuotesAdminQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID()
  goodDeedId?: string;

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
   * P2-6: `newest` removed — GoodDeedQuote has no createdAt column, so ordering by id
   * (UUIDv4) is random.  Default is `score` (relevanceScore DESC NULLS LAST, id ASC).
   */
  @IsOptional()
  @IsIn(['score'])
  sort?: 'score';
}
