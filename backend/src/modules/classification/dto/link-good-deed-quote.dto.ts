import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class LinkGoodDeedQuoteDto {
  @IsUUID()
  goodDeedId!: string;

  @IsUUID()
  quoteId!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  relevanceScore?: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}
