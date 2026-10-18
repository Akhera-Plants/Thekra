import { setRequestLocale, getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Link } from '@/i18n/navigation';
import { Breadcrumbs } from '@/components/shared/Breadcrumbs';
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
    const title = data.pair
      ? (locale === 'en' ? data.pair.titleEn : data.pair.titleAr)
      : (locale === 'en' ? (data.name || data.nameAr) : data.nameAr);
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
  const tNav = await getTranslations('nav');
  const tCrumbs = await getTranslations('breadcrumbs');

  let sin: Awaited<ReturnType<typeof getSin>>['data'];
  try {
    sin = (await getSin(slug, locale as LocaleCode)).data;
  } catch {
    notFound();
  }

  const paired = Boolean(sin.pair);
  let quotes: Awaited<ReturnType<typeof getSinQuotes>> | null = null;
  try {
    quotes = await getSinQuotes(slug, {
      page: 1,
      limit: paired ? 50 : 20,
      lang: locale as LocaleCode,
    });
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
  const seen = new Set(warning.map((item) => item.id));
  const reward = (quotes?.data.companion?.items ?? [])
    .map(toReader)
    .filter((item) => !seen.has(item.id));
  const derived = quotes?.data.derived ?? [];
  const sections: ReaderSection[] = [
    ...(warning.length > 0
      ? [{ heading: paired ? t('pairWarningHeading') : t('warningHeading'), items: warning }]
      : []),
    ...(reward.length > 0
      ? [{ heading: paired ? t('pairRewardHeading') : t('rewardHeading'), items: reward }]
      : []),
    ...derived.filter((group) => group.items.length > 0).map((group) => ({
      heading: locale === 'en' ? (group.name || group.nameAr) : group.nameAr,
      items: group.items.map(toReader),
    })),
  ];
  const derivedItems = derived.flatMap((group) => group.items.map(toReader));
  const items = interleaveReading(warning, reward).concat(derivedItems);
  const alternatives = paired ? [] : (quotes?.data.alternatives ?? []);
  const onward = alternatives[0];
  const heading = paired
    ? (locale === 'en' ? sin.pair!.titleEn : sin.pair!.titleAr)
    : (locale === 'en' ? (sin.name || sin.nameAr) : sin.nameAr);
  const description = locale === 'en' ? (sin.description || sin.descriptionAr) : sin.descriptionAr;
  const onwardName = onward
    ? (locale === 'en' ? (onward.name || onward.nameAr) : onward.nameAr)
    : null;

  return (
    <div className="page-width inner-page topic-page">
      <Breadcrumbs
        ariaLabel={tNav('breadcrumbs')}
        items={[
          { label: tCrumbs('home'), href: '/' },
          { label: tCrumbs('sins'), href: '/sins' },
          { label: heading },
        ]}
      />

      <article className="flex min-w-0 flex-1 flex-col gap-10">
        <header className="page-heading">
          <p className="eyebrow">{tCrumbs('sins')}</p>
          <h1
            id="page-title"
            tabIndex={-1}
            lang={/[\u0600-\u06FF]/.test(heading) ? 'ar' : undefined}
            dir={/[\u0600-\u06FF]/.test(heading) ? 'rtl' : undefined}
          >
            {heading}
          </h1>
          {locale === 'en' && sin.name && sin.nameAr && sin.name !== sin.nameAr ? (
            <p dir="rtl" lang="ar" className="page-lead">{sin.nameAr}</p>
          ) : null}
          {description ? <p className="page-lead">{description}</p> : null}
          {sin.rank === SinRank.KABIRA && sin.rankReference && (
            <p className="page-lead">
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
                <li key={branch.number} lang={locale === 'en' ? 'en' : 'ar'} dir={locale === 'en' ? 'ltr' : 'rtl'}>
                  {locale === 'en'
                    ? (branch.title || `Branch ${branch.number}`)
                    : branch.titleAr}
                </li>
              ))}
            </ul>
          ) : null}
          {sin.isContemporary ? (
            <p className="page-lead">{t('contemporaryNote')}</p>
          ) : null}
        </header>

        {items.length === 0 ? (
          <div className="next-step">
            <p>{t('noReminders')}</p>
            <Link href={onward ? `/good-deeds/${onward.slug}` : '/sins'} className="text-link">
              {onwardName ? (
                <span lang={/[\u0600-\u06FF]/.test(onwardName) ? 'ar' : undefined} dir={/[\u0600-\u06FF]/.test(onwardName) ? 'rtl' : undefined}>
                  {onwardName}
                </span>
              ) : (
                tCrumbs('sins')
              )}
            </Link>
          </div>
        ) : (
          <SinReader items={items} sections={sections} total={items.length} />
        )}

        <AlternativeDeedsBlock alternatives={alternatives} heading={t('alternativesHeading')} />
      </article>
    </div>
  );
}
