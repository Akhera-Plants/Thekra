import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { HadithGrade, QuoteOrigin, QuoteType } from '@prisma/client';
import { IsStrictInt } from '../../../common/decorators/is-strict-int.decorator.js';
import { ValidQuoteShape } from './valid-quote-shape.decorator.js';

export class TranslationInputDto {
  @Matches(/^[a-z]{2}(-[A-Z]{2})?$/, {
    message: 'languageCode must be in the format "en" or "en-US"',
  })
  languageCode!: string;

  @IsString()
  @MaxLength(10000)
  text!: string;
}

@ValidQuoteShape()
export class CreateQuoteDto {
  @IsEnum(QuoteType)
  type!: QuoteType;

  /**
   * Defaults to LOCAL; API_CACHED is reserved for content-sync and will be
   * rejected with 422 ORIGIN_RESERVED_FOR_SYNC.
   */
  @IsOptional()
  @IsEnum(QuoteOrigin)
  origin?: QuoteOrigin;

  @IsString()
  @MinLength(3)
  @MaxLength(10000)
  @Matches(/[\u0600-\u06FF]/, {
    message: 'textAr must contain Arabic script',
  })
  textAr!: string;

  @IsUUID()
  sourceId!: string;

  // ── Quran fields ──────────────────────────────────────────────────────────

  @IsOptional()
  @IsStrictInt()
  @Min(1)
  @Max(114)
  surahNumber?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  surahName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  surahNameAr?: string;

  @IsOptional()
  @IsStrictInt()
  @Min(1)
  @Max(286)
  ayahNumber?: number;

  // ── Hadith fields ──────────────────────────────────────────────────────────

  @IsOptional()
  @IsString()
  @MaxLength(200)
  narrator?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  narratorAr?: string;

  @IsOptional()
  @IsEnum(HadithGrade)
  grade?: HadithGrade;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  hadithReference?: string;

  // ── Book / Scholar fields ─────────────────────────────────────────────────

  @IsOptional()
  @IsString()
  @MaxLength(300)
  bookTitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  author?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  pageOrChapter?: string;

  /** Printed volume in the cited edition. Public; not stored only in rawPayload. */
  @IsOptional()
  @IsString()
  @MaxLength(40)
  volume?: string;

  /** Printed page (or page range) in the cited edition. */
  @IsOptional()
  @IsString()
  @MaxLength(40)
  page?: string;

  // ── Translations ──────────────────────────────────────────────────────────

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TranslationInputDto)
  translations?: TranslationInputDto[];

  // ── Tags ──────────────────────────────────────────────────────────────────

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  @ArrayMaxSize(20)
  tagIds?: string[];
}
