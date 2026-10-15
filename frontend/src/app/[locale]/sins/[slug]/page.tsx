import { setRequestLocale, getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Link } from '@/i18n/navigation';
import { FormattedNumber } from '@/components/shared/FormattedNumber';
import { AlternativeDeedsBlock } from '@/features/sin-reminder/components/AlternativeDeedsBlock';
import type { ReaderItem, ReaderSection } from '@/components/shared/editorial/ReminderReader';
import { SinReader } from '@/features/sin-reminder/components/SinReader';
import { interleaveReading } from '@/lib/reading';
import { getSin, getSinQuotes } from '@/lib/api/sins';
import { englishProvenance } from '@/lib/format/provenance';
import { SinRank, type LocaleCode } from '@/lib/types/enums';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/sins/[slug]'>) {
  const { slug, locale } = await params;
  try {
    const { data } = await getSin(slug, locale as LocaleCode);
    const title = locale === 'en' ? (data.name || data.nameAr) : data.nameAr;
    return { title: `${title} — ${locale === 'en' ? 'Thekra' : 'ذكرى'}` };
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

  const toReader = (item: { quote: { id: string }; link: { note: string | null; reviewLabel?: string | null } }): ReaderItem => ({
    id: item.quote.id,
    quote: item.quote as ReaderItem['quote'],
    note: item.link.note,
    reviewLabel: item.link.reviewLabel,
  });
  const warning = (quotes?.data.items ?? []).map(toReader);
  const reward = (quotes?.data.companion?.items ?? []).map(toReader);
  const derived = quotes?.data.derived ?? [];
  const sections: ReaderSection[] = [
    ...(warning.length > 0 ? [{ heading: t('warningHeading'), items: warning }] : []),
    ...(reward.length > 0 ? [{ heading: t('rewardHeading'), items: reward }] : []),
    ...derived.filter((group) => group.items.length > 0).map((group) => ({
      heading: locale === 'en' ? (group.name || group.nameAr) : group.nameAr,
      items: group.items.map(toReader),
    })),
  ];
  const derivedItems = derived.flatMap((group) => group.items.map(toReader));
  const items = interleaveReading(warning, reward).concat(derivedItems);
  const alternatives = quotes?.data.alternatives ?? [];
  const onward = alternatives[0];
  const heading = locale === 'en' ? (sin.name || sin.nameAr) : sin.nameAr;
  const description = locale === 'en' ? (sin.description || sin.descriptionAr) : sin.descriptionAr;
  const onwardName = onward
    ? (locale === 'en' ? (onward.name || onward.nameAr) : onward.nameAr)
    : null;

  return (
    <article className="mx-auto flex w-full max-w-prose min-w-0 flex-1 flex-col gap-10 px-5 py-12 md:px-8 md:py-16">
      <header className="flex flex-col gap-3">
        <h1 className={`text-4xl leading-tight lg:text-5xl ${/[\u0600-\u06FF]/.test(heading) ? 'font-arabic-display' : 'font-semibold'}`}>
          {heading}
        </h1>
        {locale === 'en' && sin.name && sin.nameAr && sin.name !== sin.nameAr ? (
          <p dir="rtl" lang="ar" className="font-arabic-ui text-sm text-muted-foreground">{sin.nameAr}</p>
        ) : null}
        {description ? <p className="text-muted-foreground">{description}</p> : null}
        {sin.rank === SinRank.KABIRA && sin.rankReference && (
          <p className="text-sm text-muted-foreground">
            {tRank(sin.rank)}
            {' — '}
            <FormattedNumber
              value={locale === 'en' ? (englishProvenance(sin.rankReference) ?? sin.rankReference) : sin.rankReference}
            />
          </p>
        )}
        {sin.branches && sin.branches.length > 0 ? (
          <ul className="flex flex-col gap-1 text-sm text-muted-foreground">
            {sin.branches.map((branch) => (
              <li key={branch.number}>{branch.titleAr}</li>
            ))}
          </ul>
        ) : null}
        {sin.isContemporary ? (
          <p className="text-sm text-muted-foreground">{t('contemporaryNote')}</p>
        ) : null}
      </header>

      {items.length === 0 ? (
        <div className="flex flex-col gap-4 border-t border-border pt-8">
          <p>{t('noReminders')}</p>
          <Link
            href={onward ? `/good-deeds/${onward.slug}` : '/browse'}
            className="inline-flex min-h-11 w-fit items-center border-b-2 border-intent-good-deed text-intent-good-deed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {onwardName ?? t('browse')}
          </Link>
        </div>
      ) : (
        <SinReader items={items} sections={sections} total={items.length} slug={slug} />
      )}

      <AlternativeDeedsBlock alternatives={alternatives} heading={t('alternativesHeading')} />
    </article>
  );
}
