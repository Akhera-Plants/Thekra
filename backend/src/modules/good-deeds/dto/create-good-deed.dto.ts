import {
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateGoodDeedDto {
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
  @IsString()
  @MaxLength(2000)
  reward?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  rewardAr?: string;

  /** UUID of the opposite Sin, if any. */
  @IsOptional()
  @IsUUID()
  oppositeSinId?: string;
}
