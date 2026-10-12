import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ReviewNoteDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
