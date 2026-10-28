import { ArrayMaxSize, ArrayMinSize, IsArray, IsUUID } from 'class-validator';
import { TransformToArray } from '../../../common/decorators/transform-to-array.decorator.js';
import { LocaleQueryDto } from '../../../common/dto/locale-query.dto.js';

export const MAX_EVIDENCE_IDS = 50;

/** `?ids=<uuid>,<uuid>…&lang=ar|en` — the evidence ids of catalog entries. */
export class PracticeEvidenceQueryDto extends LocaleQueryDto {
  @TransformToArray()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_EVIDENCE_IDS)
  @IsUUID('all', { each: true })
  ids!: string[];
}
