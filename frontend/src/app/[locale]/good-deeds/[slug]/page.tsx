import { setRequestLocale, getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Link } from '@/i18n/navigation';
import { ArabicText } from '@/components/shared/ArabicText';
import { GoodDeedReader } from '@/features/good-deed-motivation/components/GoodDeedReader';
import { getGoodDeed, getGoodDeedQuotes } from '@/lib/api/good-deeds';
import type { LocaleCode } from '@/lib/types/enums';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/good-deeds/[slug]'>) {
  const { slug, locale } = await params;
  try {
    const { data } = await getGoodDeed(slug, locale as LocaleCode);
    return { title: `${data.nameAr} — ذكرى` };
  } catch {
    return {};
  }
}

export default async function GoodDeedDetailPage({
  params,
}: PageProps<'/[locale]/good-deeds/[slug]'>) {
  const { slug, locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('goodDeedDetail');

  let deed: Awaited<ReturnType<typeof getGoodDeed>>['data'];
  try {
    deed = (await getGoodDeed(slug, locale as LocaleCode)).data;
  } catch {
    notFound();
  }

  let quotes: Awaited<ReturnType<typeof getGoodDeedQuotes>> | null = null;
  try {
    quotes = await getGoodDeedQuotes(slug, { page: 1, limit: 20, lang: locale as LocaleCode });
  } catch {
    quotes = null;
  }

  const items = (quotes?.data.items ?? []).map((item) => ({
    id: item.quote.id,
    quote: item.quote,
    note: item.link.note,
  }));

  return (
    <article className="mx-auto flex w-full max-w-prose min-w-0 flex-1 flex-col gap-10 px-5 py-12 md:px-8 md:py-16">
      <header className="flex flex-col gap-3">
        <h1 className="font-arabic-display text-4xl leading-tight lg:text-5xl">{deed.nameAr}</h1>
        {locale === 'en' && deed.name && (
          <p className="text-sm text-muted-foreground">{deed.name}</p>
        )}
        {deed.descriptionAr && <p className="text-muted-foreground">{deed.descriptionAr}</p>}
        {deed.rewardAr && (
          <aside className="border-t border-intent-good-deed pt-3" aria-label={t('rewardHeading')}>
            <p className="text-sm text-intent-good-deed">{t('rewardHeading')}</p>
            <ArabicText size="lg">{deed.rewardAr}</ArabicText>
            {locale === 'en' && deed.reward && (
              <p className="text-sm text-muted-foreground">{deed.reward}</p>
            )}
          </aside>
        )}
      </header>

      {items.length === 0 ? (
        <div className="flex flex-col gap-4 border-t border-border pt-8">
          <p>{t('noMotivations')}</p>
          <Link
            href={deed.oppositeSin ? `/sins/${deed.oppositeSin.slug}` : '/browse'}
            className="inline-flex min-h-11 w-fit items-center border-b-2 border-intent-sin text-intent-sin focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {deed.oppositeSin ? deed.oppositeSin.nameAr : t('browse')}
          </Link>
        </div>
      ) : (
        <GoodDeedReader items={items} total={quotes?.meta?.total ?? items.length} slug={slug} />
      )}

      {deed.oppositeSin && (
        <p className="text-sm text-muted-foreground">
          <Link
            href={`/sins/${deed.oppositeSin.slug}`}
            className="underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {deed.oppositeSin.nameAr}
          </Link>
        </p>
      )}
    </article>
  );
}
