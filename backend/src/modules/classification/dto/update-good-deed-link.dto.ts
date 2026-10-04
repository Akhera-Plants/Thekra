import { Transform } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class UpdateGoodDeedLinkDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  relevanceScore?: number;

  /** Pass `null` to clear the note. */
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  @Transform(({ value }: { value: unknown }) => (value === null ? null : value))
  note?: string | null;
}
