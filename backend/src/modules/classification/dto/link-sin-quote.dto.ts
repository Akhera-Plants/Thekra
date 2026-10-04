import {
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { IsStrictInt } from '../../../common/decorators/is-strict-int.decorator.js';

export class LinkSinQuoteDto {
  @IsUUID()
  sinId!: string;

  @IsUUID()
  quoteId!: string;

  @IsOptional()
  @IsStrictInt()
  @Min(0)
  @Max(100)
  relevanceScore?: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}
