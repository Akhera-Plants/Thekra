import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

class BranchGoodDeedItemDto {
  @IsUUID()
  goodDeedId!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

class BranchSinItemDto {
  @IsUUID()
  sinId!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class ReplaceBranchPracticesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BranchGoodDeedItemDto)
  goodDeeds!: BranchGoodDeedItemDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BranchSinItemDto)
  sins!: BranchSinItemDto[];
}
