export interface PageMeta {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    locale?: string;
    [key: string]: unknown;
}
export interface PaginatedResult<T> {
    data: T[];
    meta: PageMeta;
}
export declare function buildPageMeta(page: number, limit: number, total: number, extras?: Record<string, unknown>): PageMeta;
export declare function paginated<T>(data: T[], page: number, limit: number, total: number, extras?: Record<string, unknown>): PaginatedResult<T>;
