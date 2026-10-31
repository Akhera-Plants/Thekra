import { IsOptional, Matches } from 'class-validator';

/** GET /circles/:id?today=YYYY-MM-DD: the viewer's local date, so the 7 days end on their today. */
export class CircleQueryDto {
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  today?: string;
}
