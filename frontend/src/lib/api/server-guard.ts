import { notFound } from 'next/navigation';
import { reportFailure } from '@/lib/errors';
import { ApiError } from '@/lib/types/api';

/**
 * For a server component's `catch`: a 404 from the API is a real "not found" page;
 * anything else (API down, slow, 5xx) is logged with its detail and rethrown so the
 * nearest `error.tsx` shows a retry. Rethrowing also keeps the failure out of the
 * page cache: a rendered "empty" page would be served to everyone until revalidation.
 */
export function rethrowUnlessNotFound(scope: string, error: unknown): never {
  if (error instanceof ApiError && error.status === 404) notFound();
  reportFailure(scope, error);
  throw error;
}

/**
 * Slugs to prerender at build: the topics with most texts, capped. The rest render
 * on first visit and are then cached like the others. A failing API at build time
 * yields no prerendered topics rather than a failed build.
 */
export async function topSlugs<T extends { quoteCount: number }>(
  scope: string,
  load: () => Promise<T[]>,
  pick: (row: T) => string,
  limit = 30,
): Promise<string[]> {
  try {
    const rows = await load();
    return rows
      .toSorted((a, b) => b.quoteCount - a.quoteCount)
      .slice(0, limit)
      .map(pick);
  } catch (error) {
    reportFailure(`${scope} generateStaticParams`, error);
    return [];
  }
}
