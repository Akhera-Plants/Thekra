import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { BulkLinkItemDto } from './bulk-link-item.dto.js';

export class BulkLinkSinQuotesDto {
  @IsUUID()
  sinId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => BulkLinkItemDto)
  links!: BulkLinkItemDto[];
}
