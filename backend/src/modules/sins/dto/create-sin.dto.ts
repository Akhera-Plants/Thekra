import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  Matches,
} from 'class-validator';

export class CreateSinDto {
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  name!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(300)
  @Matches(/[\u0600-\u06FF]/, { message: 'nameAr must contain Arabic script' })
  nameAr!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, { message: 'slug must be kebab-case' })
  slug!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  category?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  descriptionAr?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  severity?: number;
}
