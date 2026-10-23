import type { Metadata } from 'next';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { TopicCatalog, type TopicEntry } from '@/components/shared/editorial/TopicCatalog';
import { reportFailure } from '@/lib/errors';
import { getSins } from '@/lib/api/sins';
import { getTopicThemes } from '@/lib/api/topic-themes';
import { SinRank } from '@/lib/types/enums';
import { localeAlternates } from '@/lib/seo';

// Catalogue data is cached for an hour (api-client); the page itself is rebuilt every 5 minutes,
// so a degraded render (below) is replaced quickly.
export const revalidate = 300;

export async function generateMetadata({ params }: PageProps<'/[locale]/sins'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'sins' });
  return { title: t('pageTitle'), alternates: localeAlternates(locale, '/sins') };
}

export default async function SinsPage({ params }: PageProps<'/[locale]/sins'>) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('sins');
  const tHome = await getTranslations('home');
  const tCrumbs = await getTranslations('breadcrumbs');
  const tRank = await getTranslations('sinRank');

  const sins: Awaited<ReturnType<typeof getSins>>['data'] = [];
  try {
    for (let page = 1; page <= 20; page += 1) {
      const batch = (await getSins({ page, limit: 100, lang: locale as 'ar' | 'en' })).data;
      sins.push(...batch);
      if (batch.length < 100) break;
    }
  } catch (error) {
    // The list is the page: error.tsx with a retry, not a cached empty catalogue.
    reportFailure('sins catalogue', error);
    throw error;
  }

  // Theme labels for the search («ترك الجمعة» → the prayer page with that chip on). Optional:
  // without them the search still finds topics by name.
  const themes = await getTopicThemes()
    .then((res) => res.data)
    .catch((error: unknown) => {
      reportFailure('topic themes', error);
      return [];
    });

  const entries: TopicEntry[] = sins.map((sin) => ({
    href: `/sins/${sin.slug}`,
    // The sin's own name (audit B02); the paired virtue still finds it in the search.
    nameAr: sin.nameAr,
    name: sin.name,
    aliases: sin.pair ? [sin.pair.titleAr, sin.pair.titleEn] : [],
    quoteCount: sin.quoteCount,
    domainKey: sin.domainKey ?? null,
    taxonomyOrder: sin.taxonomyOrder ?? null,
    kabira: sin.rank === SinRank.KABIRA,
    contemporary: sin.isContemporary === true,
  }));

  return (
    <TopicCatalog
      entries={entries}
      intent="sin"
      pageTitle={t('pageTitle')}
      eyebrow={tHome('sinOverline')}
      lead={tHome('sinEntryDescription')}
      pathHref="/sins"
      pathLabel={tCrumbs('sins')}
      searchPlaceholder={t('searchPlaceholder')}
      searchLabel={t('searchPlaceholder')}
      noResults={t('noResults')}
      kabiraLabel={tRank('KABIRA')}
      contemporaryLabel={t('contemporary')}
      themes={themes}
    />
  );
}
