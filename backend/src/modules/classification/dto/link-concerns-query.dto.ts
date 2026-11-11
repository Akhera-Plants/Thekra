import { Type } from 'class-transformer';
import { IsEnum, IsIn, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
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

  /** One topic only (a sin, good deed or branch id). Needs `kind`. */
  @IsOptional()
  @IsUUID()
  topicId?: string;

  /**
   * `pending` = still waiting for the owner (link not hidden), `hidden` = he hid the link, `all` (default) = both.
   * «أبقِ الربط» clears the concern; «اخفِ الربط» rejects the link and keeps the concern as the record.
   */
  @IsOptional()
  @IsIn(['pending', 'hidden', 'all'])
  decision?: 'pending' | 'hidden' | 'all';

  /** Newest first, at most this many per link table (default 100, max 200). */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;

  /** Rows to skip within each link table (with `kind`, plain paging). */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  offset?: number;
}
