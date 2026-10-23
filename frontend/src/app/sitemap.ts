import type { MetadataRoute } from 'next';
import { getBranches } from '@/lib/api/branches';
import { getGoodDeeds } from '@/lib/api/good-deeds';
import { getSins } from '@/lib/api/sins';
import { reportFailure } from '@/lib/errors';
import { env } from '@/lib/env';

/** /sitemap.xml: every public page in both languages, rebuilt hourly. */
export const revalidate = 3600;

function entry(path: string, priority: number): MetadataRoute.Sitemap[number] {
  const ar = new URL(path, env.SITE_ORIGIN).toString();
  const en = new URL(path === '/' ? '/en' : `/en${path}`, env.SITE_ORIGIN).toString();
  return { url: ar, changeFrequency: 'weekly', priority, alternates: { languages: { ar, en } } };
}

async function slugs<T>(scope: string, load: () => Promise<T[]>, pick: (row: T) => string | null): Promise<string[]> {
  try {
    return (await load()).flatMap((row) => pick(row) ?? []);
  } catch (error) {
    // A partial sitemap is better than none; the next hourly rebuild fills it in.
    reportFailure(`sitemap ${scope}`, error);
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [sins, deeds, branches] = await Promise.all([
    slugs('sins', async () => (await getSins({ limit: 100, lang: 'ar' })).data, (sin) => (sin.quoteCount > 0 ? sin.slug : null)),
    slugs('good-deeds', async () => (await getGoodDeeds({ limit: 100, lang: 'ar' })).data, (deed) => (deed.quoteCount > 0 ? deed.slug : null)),
    slugs('branches', async () => (await getBranches({ limit: 100, lang: 'ar' })).data, (branch) => String(branch.number)),
  ]);
  return [
    entry('/', 1),
    entry('/sins', 0.9),
    entry('/good-deeds', 0.9),
    entry('/branches', 0.9),
    entry('/about', 0.5),
    ...sins.map((slug) => entry(`/sins/${slug}`, 0.8)),
    ...deeds.map((slug) => entry(`/good-deeds/${slug}`, 0.8)),
    ...branches.map((number) => entry(`/branches/${number}`, 0.7)),
  ];
}
