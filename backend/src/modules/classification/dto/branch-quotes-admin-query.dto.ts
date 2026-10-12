import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { LinkReviewStatus } from '@prisma/client';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto.js';

export class BranchQuotesAdminQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID()
  imanBranchId?: string;

  @IsOptional()
  @IsUUID()
  quoteId?: string;

  @IsOptional()
  @IsEnum(LinkReviewStatus)
  reviewStatus?: LinkReviewStatus;
}
