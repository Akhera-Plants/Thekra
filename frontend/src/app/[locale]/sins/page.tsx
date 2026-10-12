import { setRequestLocale, getTranslations } from 'next-intl/server';
import { CatalogIndex, type CatalogEntry } from '@/components/shared/editorial/CatalogIndex';
import { Link } from '@/i18n/navigation';
import { getSins } from '@/lib/api/sins';
import { SinRank } from '@/lib/types/enums';

export const dynamic = 'force-dynamic';

function kabiraNumber(reference: string | null): number | null {
  if (!reference) return null;
  const match = reference.match(/رقم\s*(\d+)/);
  return match ? Number(match[1]) : null;
}

export default async function SinsPage({
  params,
  searchParams,
}: PageProps<'/[locale]/sins'>) {
  const { locale } = await params;
  const query = await searchParams;
  const showAll = query.all === '1';
  setRequestLocale(locale);
  const t = await getTranslations('sins');

  let sins: Awaited<ReturnType<typeof getSins>>['data'] = [];
  try {
    for (let page = 1; page <= 20; page += 1) {
      const batch = (await getSins({
        page,
        limit: 100,
        lang: locale as 'ar' | 'en',
        includeEmpty: showAll ? 'true' : 'false',
      })).data;
      sins.push(...batch);
      if (batch.length < 100) break;
    }
  } catch {
    sins = [];
  }

  const entries: CatalogEntry[] = sins.map((sin) => {
    const isKabira = sin.rank === SinRank.KABIRA;
    const published = sin.quoteCount > 0;
    return {
      href: `/sins/${sin.slug}`,
      nameAr: sin.nameAr,
      name: sin.name,
      quoteCount: sin.quoteCount,
      number: isKabira ? kabiraNumber(sin.rankReference) : null,
      placement: isKabira && published ? 'both' : isKabira ? 'index' : 'common',
    };
  });

  return (
    <div className="flex flex-col gap-4">
    <Link
      href={showAll ? '/sins' : '/sins?all=1'}
      className="self-start text-sm text-muted-foreground underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {showAll ? t('showPublished') : t('showAll')}
    </Link>
    <CatalogIndex
      entries={entries}
      intent="sin"
      pageTitle={t('pageTitle')}
      searchPlaceholder={t('searchPlaceholder')}
      searchLabel={t('searchPlaceholder')}
      commonHeading={t('commonHeading')}
      indexHeading={t('kabairHeading')}
      indexNote={t('kabairNote')}
      quietLabel={t('quiet')}
      noResults={t('noResults')}
      jumpLabel={t('jumpLabel')}
    />
    </div>
  );
}
