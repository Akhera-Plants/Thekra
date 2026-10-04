import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { BulkLinkItemDto } from './bulk-link-item.dto.js';

export class BulkLinkGoodDeedQuotesDto {
  @IsUUID()
  goodDeedId!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkLinkItemDto)
  @ArrayMaxSize(100)
  links!: BulkLinkItemDto[];
}
