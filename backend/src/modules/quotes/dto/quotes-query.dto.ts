import { HadithGrade, QuoteOrigin, QuoteType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { TransformToArray } from '../../../common/decorators/transform-to-array.decorator.js';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto.js';

export class QuotesQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(['ar', 'en'])
  lang?: 'ar' | 'en' = 'ar';

  @IsOptional()
  @IsString()
  @MaxLength(500)
  q?: string;

  @IsOptional()
  @TransformToArray()
  @IsEnum(QuoteType, { each: true })
  type?: QuoteType[];

  @IsOptional()
  @IsEnum(QuoteOrigin)
  origin?: QuoteOrigin;

  @IsOptional()
  @TransformToArray()
  @IsEnum(HadithGrade, { each: true })
  grades?: HadithGrade[];

  @IsOptional()
  @IsUUID()
  sourceId?: string;

  @IsOptional()
  @TransformToArray()
  @IsString({ each: true })
  tag?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(100)
  sinSlug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  goodDeedSlug?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(114)
  surahNumber?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(286)
  ayahNumber?: number;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  hasTranslation?: string;

  @IsOptional()
  @IsIn(['relevance', 'newest', 'oldest'])
  sort?: 'relevance' | 'newest' | 'oldest';
}
