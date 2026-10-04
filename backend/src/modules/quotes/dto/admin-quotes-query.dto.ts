import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';
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
}
