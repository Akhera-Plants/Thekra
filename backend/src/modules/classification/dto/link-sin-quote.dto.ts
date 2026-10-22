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

export class LinkSinQuoteDto {
  @IsUUID()
  sinId!: string;

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
   * Omitted on this admin endpoint means ACCEPTED (the curator is publishing the link).
   * Pass NOT_REVIEWED / UNDER_REVIEW / REVIEWED / REJECTED to keep it off public feeds.
   */
  @IsOptional()
  @IsEnum(LinkReviewStatus)
  reviewStatus?: LinkReviewStatus;
}
