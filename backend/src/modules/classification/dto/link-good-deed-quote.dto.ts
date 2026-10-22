import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { LinkReviewStatus } from '@prisma/client';
import { IsStrictInt } from '../../../common/decorators/is-strict-int.decorator.js';

export class LinkGoodDeedQuoteDto {
  @IsUUID()
  goodDeedId!: string;

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

  /** Omitted means ACCEPTED. Any other status stays off public feeds. */
  @IsOptional()
  @IsEnum(LinkReviewStatus)
  reviewStatus?: LinkReviewStatus;
}
