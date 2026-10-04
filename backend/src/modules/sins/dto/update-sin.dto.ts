import { IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';
import { IsOptionalNotNull } from '../../../common/decorators/is-optional-not-null.decorator.js';

/**
 * PATCH /admin/sins/:id
 *
 * Non-nullable DB columns (name, nameAr, slug) use @IsOptionalNotNull so they
 * can be omitted but reject an explicit null.
 * Nullable columns (category, description, descriptionAr, severity) use the
 * standard @IsOptional and allow null to clear the field.
 */
export class UpdateSinDto {
  @IsOptionalNotNull()
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  name?: string;

  @IsOptionalNotNull()
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  @Matches(/[\u0600-\u06FF]/, { message: 'nameAr must contain Arabic script' })
  nameAr?: string;

  @IsOptionalNotNull()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, { message: 'slug must be kebab-case' })
  slug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  category?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  descriptionAr?: string | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  severity?: number | null;
}
