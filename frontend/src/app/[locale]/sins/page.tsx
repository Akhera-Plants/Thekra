import { setRequestLocale, getTranslations } from 'next-intl/server';
import { TopicCatalog, type TopicEntry } from '@/components/shared/editorial/TopicCatalog';
import { getSins } from '@/lib/api/sins';
import { SinRank } from '@/lib/types/enums';

export const dynamic = 'force-dynamic';

export default async function SinsPage({ params }: PageProps<'/[locale]/sins'>) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('sins');
  const tRank = await getTranslations('sinRank');

  let sins: Awaited<ReturnType<typeof getSins>>['data'] = [];
  try {
    for (let page = 1; page <= 20; page += 1) {
      const batch = (await getSins({ page, limit: 100, lang: locale as 'ar' | 'en' })).data;
      sins.push(...batch);
      if (batch.length < 100) break;
    }
  } catch {
    sins = [];
  }

  const entries: TopicEntry[] = sins.map((sin) => ({
    href: `/sins/${sin.slug}`,
    nameAr: sin.pair?.titleAr ?? sin.nameAr,
    name: sin.pair?.titleEn ?? sin.name,
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
      searchPlaceholder={t('searchPlaceholder')}
      searchLabel={t('searchPlaceholder')}
      noResults={t('noResults')}
      kabiraLabel={tRank('KABIRA')}
      contemporaryLabel={t('contemporary')}
    />
  );
}
