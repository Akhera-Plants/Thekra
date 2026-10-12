import { IsEnum, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import { LinkReviewStatus } from '@prisma/client';
import { IsStrictInt } from '../../../common/decorators/is-strict-int.decorator.js';

export class LinkBranchQuoteDto {
  @IsUUID()
  imanBranchId!: string;

  @IsUUID()
  quoteId!: string;

  @IsOptional()
  @IsStrictInt()
  @Min(0)
  @Max(100)
  relevanceScore?: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;

  /**
   * Omitted means ACCEPTED, because this endpoint is the curator publishing a link.
   * Similarity suggestions must send NOT_REVIEWED.
   * Chapter-derived links send ACCEPTED and put the chapter title in note.
   */
  @IsOptional()
  @IsEnum(LinkReviewStatus)
  reviewStatus?: LinkReviewStatus;
}
