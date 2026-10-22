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

export function buildPageMeta(
  page: number,
  limit: number,
  total: number,
  extras: Record<string, unknown> = {},
): PageMeta {
  const totalPages = total === 0 ? 0 : Math.ceil(total / limit);
  return {
    page,
    limit,
    total,
    totalPages,
    hasNext: page < totalPages,
    ...extras,
  };
}

export function paginated<T>(
  data: T[],
  page: number,
  limit: number,
  total: number,
  extras: Record<string, unknown> = {},
): PaginatedResult<T> {
  return { data, meta: buildPageMeta(page, limit, total, extras) };
}
