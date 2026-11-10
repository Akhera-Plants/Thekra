import { LinkConcern } from '@prisma/client';
export declare const LINK_KINDS: readonly ["sin", "good-deed", "branch"];
export type LinkKind = (typeof LINK_KINDS)[number];
export declare class LinkConcernsQueryDto {
    kind?: LinkKind;
    concern?: LinkConcern;
    limit?: number;
}
