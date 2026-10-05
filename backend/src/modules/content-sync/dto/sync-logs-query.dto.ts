import { IsDateString, IsEnum, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { SyncStatus } from '@prisma/client';
import { Type } from 'class-transformer';

export class SyncLogsQueryDto {
  @IsOptional()
  @IsUUID()
  sourceId?: string;

  @IsOptional()
  @IsEnum(SyncStatus)
  status?: SyncStatus;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
