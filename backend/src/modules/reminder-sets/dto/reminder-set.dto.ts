import { PartialType } from '@nestjs/mapped-types';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { REMINDER_SET_MAX_ITEMS } from '../reminder-set-rules.js';

export class CreateReminderSetDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, { message: 'slug must be kebab-case' })
  slug!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  titleAr!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  titleEn!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  published?: boolean;
}

export class UpdateReminderSetDto extends PartialType(CreateReminderSetDto) {}

/** The whole ordered list of a set's texts (replaces the previous one). */
export class SetReminderSetItemsDto {
  @IsArray()
  @ArrayMaxSize(REMINDER_SET_MAX_ITEMS)
  @ArrayUnique()
  @IsUUID('all', { each: true })
  quoteIds!: string[];
}
