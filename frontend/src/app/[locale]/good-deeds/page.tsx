import { setRequestLocale, getTranslations } from 'next-intl/server';
import { CatalogIndex, type CatalogEntry } from '@/components/shared/editorial/CatalogIndex';
import { Link } from '@/i18n/navigation';
import { getGoodDeeds } from '@/lib/api/good-deeds';
import type { LocaleCode } from '@/lib/types/enums';

export const dynamic = 'force-dynamic';

export default async function GoodDeedsPage({
  params,
  searchParams,
}: PageProps<'/[locale]/good-deeds'>) {
  const { locale } = await params;
  const query = await searchParams;
  const showAll = query.all === '1';
  setRequestLocale(locale);
  const t = await getTranslations('goodDeeds');

  let deeds: Awaited<ReturnType<typeof getGoodDeeds>>['data'] = [];
  try {
    for (let page = 1; page <= 20; page += 1) {
      const batch = (await getGoodDeeds({
        page,
        limit: 100,
        lang: locale as LocaleCode,
        includeEmpty: showAll ? 'true' : 'false',
      })).data;
      deeds.push(...batch);
      if (batch.length < 100) break;
    }
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
    <div className="flex flex-col gap-4">
    <Link
      href={showAll ? '/good-deeds' : '/good-deeds?all=1'}
      className="self-start text-sm text-muted-foreground underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {showAll ? t('showPublished') : t('showAll')}
    </Link>
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
    </div>
  );
}
