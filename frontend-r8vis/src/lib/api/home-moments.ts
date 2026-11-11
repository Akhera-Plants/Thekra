import { env } from '@/lib/env';
import { reportFailure } from '@/lib/errors';
import { z } from '@/lib/zod';
import type { LocaleCode } from '@/lib/types/enums';

/**
 * «في لحظات مثل هذه» (owner round 6, C-09): one list for every user, chosen by us on the API
 * (`GET /v1/home-moments`, CDN-cached), never by the user. Read with native fetch so the home's ISR caches it.
 * When the API cannot answer, the section is left out (no hard-coded fallback list that could drift from the API).
 */

const REVALIDATE_SECONDS = 300;
const REQUEST_TIMEOUT_MS = 5000;

const momentSchema = z.object({
  key: z.string(),
  label: z.string(),
  situation: z.string().nullable(),
  icon: z.string(),
  topic: z.object({
    type: z.enum(['sin', 'good-deed', 'branch']),
    slug: z.string(),
    title: z.string(),
    path: z.string().regex(/^\/(sins|good-deeds|branches)\/[a-z0-9-]+$/),
  }),
});

export type HomeMoment = z.infer<typeof momentSchema>;

const responseSchema = z.object({ data: z.array(z.unknown()) });

export async function getHomeMoments(lang: LocaleCode): Promise<HomeMoment[]> {
  try {
    const url = new URL(`${env.NEXT_PUBLIC_API_URL}/v1/home-moments`);
    url.searchParams.set('lang', lang);
    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
      next: { revalidate: REVALIDATE_SECONDS },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`GET /v1/home-moments responded ${response.status}`);
    const { data } = responseSchema.parse(await response.json());
    // A malformed row is skipped, not the whole list.
    return data.flatMap((row) => {
      const parsed = momentSchema.safeParse(row);
      return parsed.success ? [parsed.data] : [];
    });
  } catch (error) {
    reportFailure('home moments', error);
    return [];
  }
}
