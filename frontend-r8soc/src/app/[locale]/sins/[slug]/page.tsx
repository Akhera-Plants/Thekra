import type { Metadata } from 'next';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { Breadcrumbs } from '@/components/shared/Breadcrumbs';
import { SectionDivider } from '@/components/shared/SectionDivider';
// The variants module only (no 'use client'), so this server component can call it.
import { buttonVariants } from '@/components/shared/kit/button/variants';
import { cn } from '@/lib/utils';
import { FormattedNumber } from '@/components/shared/FormattedNumber';
import { AlternativeDeedsBlock } from '@/features/sin-reminder/components/AlternativeDeedsBlock';
import type { ReaderItem, ReaderSection } from '@/components/shared/editorial/ReminderReader';
import { SinReader } from '@/features/sin-reminder/components/SinReader';
import { StartProgramLink } from '@/features/practice/components/StartProgramLink';
import { TopicBranchLinks } from '@/features/topic/components/TopicTemplate';
import { TOPIC_PAGE_SIZE, interleaveReading } from '@/lib/reading';
import { getSin, getSinQuotes, getSins } from '@/lib/api/sins';
import { rethrowUnlessNotFound, topSlugs } from '@/lib/api/server-guard';
import { englishOnlyProvenance } from '@/lib/format/provenance';
import { SinRank, type LocaleCode } from '@/lib/types/enums';
import type { SinQuotesMeta } from '@/lib/types/api';
import { localeAlternates, metaDescription } from '@/lib/seo';

// Same for every visitor: cached and revalidated, not rendered per request. The `?theme=` chip
// is applied on the client (useTopicReader), which is what keeps this page out of dynamic rendering.
export const revalidate = 300;

export async function generateStaticParams() {
  const slugs = await topSlugs('sins', async () => (await getSins({ limit: 100, lang: 'ar' })).data, (sin) => sin.slug);
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/sins/[slug]'>): Promise<Metadata> {
  const { slug, locale } = await params;
  try {
    const { data } = await getSin(slug, locale as LocaleCode);
    // A sin page is named by the sin; the paired virtue is a secondary line (audit B02).
    const title = locale === 'en' ? (data.name || data.nameAr) : data.nameAr;
    return {
      title,
      description: metaDescription(locale === 'en' ? data.description : data.descriptionAr),
      alternates: localeAlternates(locale, `/sins/${slug}`),
    };
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
  } catch (error) {
    rethrowUnlessNotFound('sin page', error);
  }

  const paired = Boolean(sin.pair);
  // The texts are the page: if they cannot be loaded, fail (error.tsx offers a retry) instead of
  // rendering and caching an empty reader for everyone.
  const quotes = await getSinQuotes(slug, {
    page: 1,
    limit: TOPIC_PAGE_SIZE,
    lang: locale as LocaleCode,
  }).catch((error: unknown) => rethrowUnlessNotFound('sin quotes', error));

  const toReader = (item: { quote: { id: string }; link: { id: string; note: string | null } }): ReaderItem => ({
    id: item.quote.id,
    quote: item.quote as ReaderItem['quote'],
    note: item.link.note,
    linkId: item.link.id,
  });
  const warning = (quotes?.data.items ?? []).map(toReader);
  const seen = new Set(warning.map((item) => item.id));
  const reward = (quotes?.data.companion?.items ?? [])
    .map(toReader)
    .filter((item) => !seen.has(item.id));
  const derived = quotes?.data.derived ?? [];
  const quotesMeta = quotes?.meta as SinQuotesMeta | undefined;
  const activeTheme = quotesMeta?.theme ?? null;
  // A theme is one merged list (warning and reward together), so it has no section headings.
  const sections: ReaderSection[] = activeTheme ? [] : [
    ...(warning.length > 0
      ? [{ heading: paired ? t('pairWarningHeading') : t('warningHeading'), items: warning, source: 'items' as const }]
      : []),
    ...(reward.length > 0
      ? [{ heading: paired ? t('pairRewardHeading') : t('rewardHeading'), items: reward, source: 'companion' as const }]
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
  // The sin's own name: a paired page used to show the virtue («الإخلاص») under «كبيرة» (audit B02).
  const heading = locale === 'en' ? (sin.name || sin.nameAr) : sin.nameAr;
  const counterpart = sin.pair ? (locale === 'en' ? sin.pair.titleEn : sin.pair.titleAr) : null;
  // English shows the English description or nothing: never Arabic prose on /en.
  const description = locale === 'en' ? sin.description : sin.descriptionAr;
  const rankReference = locale === 'en' ? englishOnlyProvenance(sin.rankReference) : sin.rankReference;
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
          <div className="title-line">
            <h1
              id="page-title"
              tabIndex={-1}
              lang={/[\u0600-\u06FF]/.test(heading) ? 'ar' : undefined}
              dir={/[\u0600-\u06FF]/.test(heading) ? 'rtl' : undefined}
            >
              {heading}
            </h1>
            <StartProgramLink slug={slug} />
          </div>
          {description ? <p className="page-lead">{description}</p> : null}
          {sin.rank === SinRank.KABIRA && sin.rankReference && (
            <p className="page-lead">
              {tRank(sin.rank)}
              {rankReference ? (
                <>
                  {' — '}
                  <FormattedNumber value={rankReference} />
                </>
              ) : null}
            </p>
          )}
          {sin.isContemporary ? (
            <p className="page-lead">{t('contemporaryNote')}</p>
          ) : null}
        </header>

        {/* The topic template (owner, 2026-11-01): the tabs right under the title; «الميزان» and every text inside them,
            then شعب الإيمان and the opposite. */}
        {items.length === 0 ? (
          <div className="flex flex-col gap-6">
            <div className="next-step">
              <p>{t('noReminders')}</p>
              <Link href={onward ? `/good-deeds/${onward.slug}` : '/sins'} className="outline-button mt-3">
                {onwardName ? (
                  <span lang={/[\u0600-\u06FF]/.test(onwardName) ? 'ar' : undefined} dir={/[\u0600-\u06FF]/.test(onwardName) ? 'rtl' : undefined}>
                    {onwardName}
                  </span>
                ) : (
                  tCrumbs('sins')
                )}
              </Link>
            </div>
          </div>
        ) : (
          <SinReader
            slug={slug}
            lang={locale}
            items={items}
            sections={sections}
            total={items.length}
            countsByKind={quotesMeta?.countsByKind}
            themes={quotesMeta?.themes}
            initialTheme={activeTheme}
            initialHasNext={quotesMeta?.hasNext ?? false}
            complete={derived.some((group) => group.items.length > 0) && !(quotesMeta?.hasNext ?? false)}
          />
        )}

        {/* The flower between sections, never a line (O-04/W-23): texts · من شعب الإيمان · الفضيلة المقابلة · البدائل. */}
        {sin.branches && sin.branches.length > 0 ? (
          <>
            <SectionDivider />
            <TopicBranchLinks branches={sin.branches} />
          </>
        ) : null}

        {counterpart && sin.pair ? (
          <>
            <SectionDivider />
            <section aria-labelledby="pair-title" className="flex flex-col gap-3">
              <h2 id="pair-title" className="text-xl font-medium">
                {t('pairCounterpart')}
              </h2>
              {/* A link styled as the kit button, not `<Button asChild>`: from a server component the Link can reach the
                  client Slot as a lazy reference during SSR, which fails («Slot failed to slot onto its children»). */}
              <Link
                href={`/good-deeds/${sin.pair.do}`}
                className={cn(buttonVariants({ variant: 'outline', tone: 'primary', size: 'md' }), 'self-start')}
              >
                {counterpart}
              </Link>
            </section>
          </>
        ) : null}
        {alternatives.length > 0 ? <SectionDivider /> : null}
        <AlternativeDeedsBlock alternatives={alternatives} heading={t('alternativesHeading')} />
      </article>
    </div>
  );
}
