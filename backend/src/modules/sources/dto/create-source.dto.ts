import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
} from 'class-validator';
import { SourceType } from '@prisma/client';

export class CreateSourceDto {
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  nameAr?: string;

  @IsEnum(SourceType)
  type!: SourceType;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  author?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  authorAr?: string;

  /** BCP-47 language code; defaults to "ar". */
  @IsOptional()
  @IsString()
  @MaxLength(10)
  language?: string;

  @IsOptional()
  @IsBoolean()
  isExternalApi?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  apiProvider?: string;

  @IsOptional()
  @IsUrl({}, { message: 'apiBaseUrl must be a valid URL' })
  @MaxLength(500)
  apiBaseUrl?: string;
}
