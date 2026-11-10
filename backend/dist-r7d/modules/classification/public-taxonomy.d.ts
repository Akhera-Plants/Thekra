export declare function isAutoChapter(origin: string | null | undefined): boolean;
export declare function isPublicTopic<T extends {
    origin?: string | null;
    isHidden?: boolean | null;
}>(row: T | null | undefined): row is T;
export declare function autoLinkExclusion(): {
    NOT: {
        OR: ({
            note: {
                startsWith: string;
            };
            AND?: undefined;
        } | {
            AND: ({
                note: {
                    contains: string;
                };
                OR?: undefined;
            } | {
                OR: ({
                    relevanceScore: null;
                } | {
                    relevanceScore: number;
                })[];
                note?: undefined;
            })[];
            note?: undefined;
        })[];
    };
};
export declare function publicAcceptedLinkWhere(): {
    NOT: {
        OR: ({
            note: {
                startsWith: string;
            };
            AND?: undefined;
        } | {
            AND: ({
                note: {
                    contains: string;
                };
                OR?: undefined;
            } | {
                OR: ({
                    relevanceScore: null;
                } | {
                    relevanceScore: number;
                })[];
                note?: undefined;
            })[];
            note?: undefined;
        })[];
    };
    reviewStatus: "ACCEPTED";
    quote: import("@prisma/client").Prisma.QuoteWhereInput;
};
export declare function readerLinkNote(note: string | null | undefined): string | null;
