import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export const REPORT_REASONS = ['TEXT', 'ISNAD', 'GRADE', 'CLASSIFICATION', 'OTHER'] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export class ReportQuoteDto {
  @IsIn(REPORT_REASONS)
  reason!: ReportReason;

  @IsOptional()
  @IsString()
  @MaxLength(400)
  note?: string;
}
