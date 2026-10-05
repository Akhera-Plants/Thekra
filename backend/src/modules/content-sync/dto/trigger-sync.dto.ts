import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class SyncScopeDto {
  /** First surah to sync (Quran providers). */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(114)
  surahFrom?: number;

  /** Last surah to sync (Quran providers). */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(114)
  surahTo?: number;

  /** Collection slug for Hadith providers (e.g. "bukhari"). */
  @IsOptional()
  @IsString()
  collection?: string;

  /** First book number within the collection. */
  @IsOptional()
  @IsInt()
  @Min(1)
  bookFrom?: number;

  /** Last book number within the collection. */
  @IsOptional()
  @IsInt()
  @Min(1)
  bookTo?: number;
}

export class TriggerSyncDto {
  /** The Source to sync (must have isExternalApi=true). */
  @IsUUID()
  sourceId!: string;

  /** Scope narrows which surahs/collections to sync. */
  @IsOptional()
  @ValidateNested()
  @Type(() => SyncScopeDto)
  scope?: SyncScopeDto;

  /**
   * If true: fetch + map + validate but NO writes.
   * SyncLog is recorded with status=SUCCESS and errorMessage="dryRun: …".
   */
  @IsOptional()
  @IsBoolean()
  dryRun?: boolean = false;

  /**
   * Bypass the "already running" guard — useful when you know a previous run
   * crashed and left a stale SyncLog.
   */
  @IsOptional()
  @IsBoolean()
  force?: boolean = false;
}
