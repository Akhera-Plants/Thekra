import { HadithGrade } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { ToBoolean } from '../../../common/decorators/to-boolean.decorator.js';
import { TransformToArray } from '../../../common/decorators/transform-to-array.decorator.js';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto.js';
import { NotMawdu } from '../grade-policy.js';

export class HadithQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(['ar', 'en'])
  lang?: 'ar' | 'en' = 'ar';

  @IsOptional()
  @IsUUID()
  collectionId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  narrator?: string;

  @IsOptional()
  @TransformToArray()
  @IsEnum(HadithGrade, { each: true })
  @NotMawdu()
  grades?: HadithGrade[];

  @IsOptional()
  @ToBoolean()
  @IsBoolean()
  includeWeak?: boolean = false;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  q?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  reference?: string;
}
