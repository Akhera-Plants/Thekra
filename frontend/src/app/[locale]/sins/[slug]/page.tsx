import { setRequestLocale, getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Link } from '@/i18n/navigation';
import { FormattedNumber } from '@/components/shared/FormattedNumber';
import { AlternativeDeedsBlock } from '@/features/sin-reminder/components/AlternativeDeedsBlock';
import { SinReader } from '@/features/sin-reminder/components/SinReader';
import { getSin, getSinQuotes } from '@/lib/api/sins';
import { SinRank, type LocaleCode } from '@/lib/types/enums';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/sins/[slug]'>) {
  const { slug, locale } = await params;
  try {
    const { data } = await getSin(slug, locale as LocaleCode);
    return { title: `${data.nameAr} — ذكرى` };
  } catch {
    return {};
  }
}

export default async function SinDetailPage({
  params,
}: PageProps<'/[locale]/sins/[slug]'>) {
  const { slug, locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('sinDetail');
  const tRank = await getTranslations('sinRank');

  let sin: Awaited<ReturnType<typeof getSin>>['data'];
  try {
    sin = (await getSin(slug, locale as LocaleCode)).data;
  } catch {
    notFound();
  }

  let quotes: Awaited<ReturnType<typeof getSinQuotes>> | null = null;
  try {
    quotes = await getSinQuotes(slug, { page: 1, limit: 20, lang: locale as LocaleCode });
  } catch {
    quotes = null;
  }

  const items = (quotes?.data.items ?? []).map((item) => ({
    id: item.quote.id,
    quote: item.quote,
    note: item.link.note,
  }));
  const alternatives = quotes?.data.alternatives ?? [];
  const onward = alternatives[0];

  return (
    <article className="mx-auto flex w-full max-w-prose min-w-0 flex-1 flex-col gap-10 px-5 py-12 md:px-8 md:py-16">
      <header className="flex flex-col gap-3">
        <h1 className="font-arabic-display text-4xl leading-tight lg:text-5xl">{sin.nameAr}</h1>
        {locale === 'en' && sin.name && (
          <p className="text-sm text-muted-foreground">{sin.name}</p>
        )}
        {sin.descriptionAr && <p className="text-muted-foreground">{sin.descriptionAr}</p>}
        {sin.rank === SinRank.KABIRA && sin.rankReference && (
          <p className="text-sm text-muted-foreground">
            {tRank(sin.rank)}
            {' — '}
            <FormattedNumber value={sin.rankReference} />
          </p>
        )}
      </header>

      {items.length === 0 ? (
        <div className="flex flex-col gap-4 border-t border-border pt-8">
          <p>{t('noReminders')}</p>
          <Link
            href={onward ? `/good-deeds/${onward.slug}` : '/browse'}
            className="inline-flex min-h-11 w-fit items-center border-b-2 border-intent-good-deed text-intent-good-deed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {onward ? onward.nameAr : t('browse')}
          </Link>
        </div>
      ) : (
        <SinReader items={items} total={quotes?.meta?.total ?? items.length} slug={slug} />
      )}

      <AlternativeDeedsBlock alternatives={alternatives} heading={t('alternativesHeading')} />
    </article>
  );
}
