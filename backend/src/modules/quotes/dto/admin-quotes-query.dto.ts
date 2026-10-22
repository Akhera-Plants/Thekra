import { TextSource } from '@prisma/client';
import { IsBoolean, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ToBoolean } from '../../../common/decorators/to-boolean.decorator.js';
import { QuotesQueryDto } from './quotes-query.dto.js';

export class AdminQuotesQueryDto extends QuotesQueryDto {
  /** Filter for quotes not linked to any sin or good deed. */
  @IsOptional()
  @ToBoolean()
  @IsBoolean()
  unlinkedOnly?: boolean;

  /** Filter quotes missing a translation in the given language code. */
  @IsOptional()
  @IsString()
  @MaxLength(10)
  missingTranslation?: string;

  /** DIGITAL, OCR, or MANUAL. */
  @IsOptional()
  @IsEnum(TextSource)
  textSource?: TextSource;

  /** OCR rows a reviewer has not yet compared with the PDF page. */
  @IsOptional()
  @ToBoolean()
  @IsBoolean()
  unverifiedOnly?: boolean;
}
