import { setRequestLocale, getTranslations } from 'next-intl/server';
import { CatalogIndex, type CatalogEntry } from '@/components/shared/editorial/CatalogIndex';
import { getSins } from '@/lib/api/sins';
import { SinRank } from '@/lib/types/enums';

export const dynamic = 'force-dynamic';

function kabiraNumber(reference: string | null): number | null {
  if (!reference) return null;
  const match = reference.match(/رقم\s*(\d+)/);
  return match ? Number(match[1]) : null;
}

export default async function SinsPage({ params }: PageProps<'/[locale]/sins'>) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('sins');

  let sins: Awaited<ReturnType<typeof getSins>>['data'] = [];
  try {
    sins = (await getSins({ limit: 100, lang: locale as 'ar' | 'en' })).data;
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
  );
}
