import { setRequestLocale, getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Link } from '@/i18n/navigation';
import { ArabicText } from '@/components/shared/ArabicText';
import type { ReaderItem, ReaderSection } from '@/components/shared/editorial/ReminderReader';
import { GoodDeedReader } from '@/features/good-deed-motivation/components/GoodDeedReader';
import { interleaveReading } from '@/lib/reading';
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

  const toReader = (item: { quote: { id: string }; link: { note: string | null; reviewLabel?: string | null } }): ReaderItem => ({
    id: item.quote.id,
    quote: item.quote as ReaderItem['quote'],
    note: item.link.note,
    reviewLabel: item.link.reviewLabel,
  });
  const virtue = (quotes?.data.items ?? []).map(toReader);
  const neglect = (quotes?.data.companion?.items ?? []).map(toReader);
  const derived = quotes?.data.derived ?? [];
  const sections: ReaderSection[] = [
    ...(virtue.length > 0 ? [{ heading: t('virtueHeading'), items: virtue }] : []),
    ...(neglect.length > 0 ? [{ heading: t('neglectHeading'), items: neglect }] : []),
    ...derived.filter((group) => group.items.length > 0).map((group) => ({
      heading: group.nameAr,
      items: group.items.map(toReader),
    })),
  ];
  const items = interleaveReading(virtue, neglect).concat(derived.flatMap((group) => group.items.map(toReader)));

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
        {deed.branches && deed.branches.length > 0 ? (
          <ul className="flex flex-col gap-1 text-sm text-muted-foreground">
            {deed.branches.map((branch) => (
              <li key={branch.number}>{branch.titleAr}</li>
            ))}
          </ul>
        ) : null}
        {deed.isContemporary ? (
          <p className="text-sm text-muted-foreground">{t('contemporaryNote')}</p>
        ) : null}
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
        <GoodDeedReader items={items} sections={sections} total={items.length} slug={slug} />
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
