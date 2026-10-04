import { PartialType, OmitType } from '@nestjs/mapped-types';
import { CreateQuoteDto } from './create-quote.dto.js';

/**
 * PATCH /admin/quotes/:id
 * `type` and `origin` are immutable after creation and therefore excluded.
 */
export class UpdateQuoteDto extends PartialType(
  OmitType(CreateQuoteDto, ['type', 'origin'] as const),
) {}
