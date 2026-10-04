import { Type } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';
import { QuotesQueryDto } from './quotes-query.dto.js';

export class AdminQuotesQueryDto extends QuotesQueryDto {
  /** Filter for quotes not linked to any sin or good deed. */
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  unlinkedOnly?: boolean;

  /** Filter quotes missing a translation in the given language code. */
  @IsOptional()
  @IsString()
  @MaxLength(10)
  missingTranslation?: string;
}
