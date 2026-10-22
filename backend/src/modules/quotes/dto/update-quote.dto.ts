import { IntersectionType, OmitType, PartialType } from '@nestjs/mapped-types';
import { IsString, IsUUID, Matches, MaxLength, MinLength } from 'class-validator';
import { IsOptionalNotNull } from '../../../common/decorators/is-optional-not-null.decorator.js';
import { CreateQuoteDto } from './create-quote.dto.js';

/**
 * The two non-nullable DB columns are pulled out of the PartialType so they
 * can carry @IsOptionalNotNull — allowing omission but rejecting explicit null.
 * Everything else stays in PartialType and may be null to clear nullable columns.
 */
class NonNullableQuoteFields {
  @IsOptionalNotNull()
  @IsString()
  @MinLength(3)
  @MaxLength(10000)
  @Matches(/[\u0600-\u06FF]/, { message: 'textAr must contain Arabic script' })
  textAr?: string;

  @IsOptionalNotNull()
  @IsUUID()
  sourceId?: string;
}

/**
 * PATCH /admin/quotes/:id
 * `type` and `origin` are immutable after creation — excluded.
 * `textAr` and `sourceId` are non-nullable in the DB — reject explicit null.
 */
export class UpdateQuoteDto extends IntersectionType(
  PartialType(OmitType(CreateQuoteDto, ['type', 'origin', 'textAr', 'sourceId'] as const)),
  NonNullableQuoteFields,
) {}
