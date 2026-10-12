import { setRequestLocale, getTranslations } from 'next-intl/server';
import { CatalogIndex, type CatalogEntry } from '@/components/shared/editorial/CatalogIndex';
import { getGoodDeeds } from '@/lib/api/good-deeds';
import type { LocaleCode } from '@/lib/types/enums';

export const dynamic = 'force-dynamic';

export default async function GoodDeedsPage({
  params,
}: PageProps<'/[locale]/good-deeds'>) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('goodDeeds');

  let deeds: Awaited<ReturnType<typeof getGoodDeeds>>['data'] = [];
  try {
    deeds = (await getGoodDeeds({ limit: 100, lang: locale as LocaleCode })).data;
  } catch {
    deeds = [];
  }

  const published = deeds.filter((deed) => deed.quoteCount > 0);
  const quiet = deeds.filter((deed) => deed.quoteCount === 0);
  const entries: CatalogEntry[] = [
    ...published.map((deed) => ({
      href: `/good-deeds/${deed.slug}`,
      nameAr: deed.nameAr,
      name: deed.name,
      quoteCount: deed.quoteCount,
      number: null,
      placement: 'common' as const,
    })),
    ...quiet.map((deed, index) => ({
      href: `/good-deeds/${deed.slug}`,
      nameAr: deed.nameAr,
      name: deed.name,
      quoteCount: deed.quoteCount,
      number: index + 1,
      placement: 'index' as const,
    })),
  ];

  return (
    <CatalogIndex
      entries={entries}
      intent="good-deed"
      pageTitle={t('pageTitle')}
      searchPlaceholder={t('searchPlaceholder')}
      searchLabel={t('searchPlaceholder')}
      commonHeading={t('commonHeading')}
      indexHeading={t('indexHeading')}
      quietLabel={t('quiet')}
      noResults={t('noResults')}
      jumpLabel={t('jumpLabel')}
    />
  );
}
