import { Type } from 'class-transformer';
import { IsEnum, IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { LinkConcern } from '@prisma/client';

export const LINK_KINDS = ['sin', 'good-deed', 'branch'] as const;
export type LinkKind = (typeof LINK_KINDS)[number];

/** GET /admin/link-concerns: the owner's review list of links flagged while linking. */
export class LinkConcernsQueryDto {
  /** One link table only; all three by default. */
  @IsOptional()
  @IsIn(LINK_KINDS)
  kind?: LinkKind;

  @IsOptional()
  @IsEnum(LinkConcern)
  concern?: LinkConcern;

  /** Newest first, at most this many per link table (default 100, max 200). */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;
}
