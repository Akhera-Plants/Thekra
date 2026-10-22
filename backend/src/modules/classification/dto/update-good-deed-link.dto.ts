import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { LinkReviewStatus } from '@prisma/client';
import { IsStrictInt } from '../../../common/decorators/is-strict-int.decorator.js';

export class UpdateGoodDeedLinkDto {
  @IsOptional()
  @IsStrictInt()
  @Min(0)
  @Max(100)
  relevanceScore?: number;

  /** Pass `null` to clear the note. */
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  @Transform(({ value }: { value: unknown }) => (value === null ? null : value))
  note?: string | null;

  @IsOptional()
  @IsEnum(LinkReviewStatus)
  reviewStatus?: LinkReviewStatus;
}
