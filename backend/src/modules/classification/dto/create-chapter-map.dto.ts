import { ChapterMapTarget } from '@prisma/client';
import { IsBoolean, IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateChapterMapDto {
  @IsUUID()
  sourceId!: string;

  @IsString()
  @MaxLength(200)
  chapterKey!: string;

  @IsString()
  @MaxLength(500)
  chapterTitleAr!: string;

  @IsEnum(ChapterMapTarget)
  targetType!: ChapterMapTarget;

  @IsOptional()
  @IsUUID()
  sinId?: string;

  @IsOptional()
  @IsUUID()
  goodDeedId?: string;

  @IsOptional()
  @IsUUID()
  imanBranchId?: string;

  /** False until the owner reviews this chapter→entity row once. */
  @IsOptional()
  @IsBoolean()
  reviewed?: boolean;
}
