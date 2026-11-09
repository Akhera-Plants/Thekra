import { IsOptional, IsUUID } from 'class-validator';
import { LocaleQueryDto } from '../../../common/dto/locale-query.dto.js';

/** GET /quotes/:id/reader?lang=ar|en&linkId=<topic↔text link id from the topic page item>. */
export class QuoteReaderQueryDto extends LocaleQueryDto {
  /** `items[].link.id` of the topic page the reader was opened from; it selects the «وجه التذكير». */
  @IsOptional()
  @IsUUID()
  linkId?: string;
}
