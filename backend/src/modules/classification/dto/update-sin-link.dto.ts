import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { LinkReviewStatus } from '@prisma/client';
import { IsStrictInt } from '../../../common/decorators/is-strict-int.decorator.js';
import { LinkEditorialFieldsDto } from './link-editorial-fields.dto.js';

/** PATCH a link: score, note, review status, and the round-6 editorial fields (LinkEditorialFieldsDto). */
export class UpdateSinLinkDto extends LinkEditorialFieldsDto {
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
