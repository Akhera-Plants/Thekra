import { IsISO8601, IsOptional } from 'class-validator';

/** `?since=<ISO 8601>`: only changes after it; everything when absent. */
export class PracticeChangesQueryDto {
  @IsOptional()
  @IsISO8601({ strict: true })
  since?: string;
}
